import logging
import os
import subprocess
import sys
import time
from enum import IntEnum
from xml.etree import ElementTree
from xml.etree.ElementTree import Element

import libvirt
import pydantic
import uvicorn
from fastapi import FastAPI, Depends, Response, BackgroundTasks, HTTPException
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import RedirectResponse
from starlette.staticfiles import StaticFiles

# Logging to stdout
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler(sys.stdout))

app = FastAPI(
    openapi_url="/api/openapi.json",
    docs_url="/api/docs"
)


class DomainState(IntEnum):
    NOSTATE = libvirt.VIR_DOMAIN_NOSTATE
    RUNNING = libvirt.VIR_DOMAIN_RUNNING
    BLOCKED = libvirt.VIR_DOMAIN_BLOCKED
    PAUSED = libvirt.VIR_DOMAIN_PAUSED
    SHUTDOWN = libvirt.VIR_DOMAIN_SHUTDOWN
    SHUTOFF = libvirt.VIR_DOMAIN_SHUTOFF
    CRASHED = libvirt.VIR_DOMAIN_CRASHED
    PMSUSPENDED = libvirt.VIR_DOMAIN_PMSUSPENDED


async def get_conn():
    conn = libvirt.open("qemu:///system")
    try:
        yield conn
    finally:
        conn.close()


class DomainPatchModel(BaseModel):
    state: DomainState | None = None
    autostart: bool | None = None

    @pydantic.validator('state', pre=True)
    def validate_choice(cls, value):
        try:
            return DomainState[value]
        except KeyError as e:
            raise ValueError(f"Error validating choice {e}. Valid choices are: {[x.name for x in DomainState]}")


def parse_xml_desc(xml_desc: str) -> Element:
    tree = ElementTree.fromstring(xml_desc)
    return tree


def domain_info(domain: libvirt.virDomain) -> dict:
    state, _ = domain.state()
    detail = parse_xml_desc(domain.XMLDesc())
    title_element = detail.find('title')
    return {
        'id': domain.ID(),
        'uuid': domain.UUIDString(),
        'autostart': domain.autostart() == 1,
        'state': DomainState(state).name,
        'name': domain.name(),
        'title': domain.name if title_element is None else title_element.text
    }


@app.get("/api/domain")
async def list_domains(conn: libvirt.virConnect = Depends(get_conn)) -> list[dict]:
    all_domains: list[libvirt.virDomain] = conn.listAllDomains()
    result = [domain_info(x) for x in all_domains]
    return sorted(result, key=lambda x: x['name'])


@app.get("/api/domain/{name}")
async def get_domain(name: str, conn: libvirt.virConnect = Depends(get_conn)) -> dict:
    domain = conn.lookupByName(name)
    return domain_info(domain)


def switch_domain(shutdown: list[str], destroy: list[str], conn: libvirt.virConnect, startup: str | None = None,
                  host_shutdown: bool | None = None):
    # Shut down domains as necessary
    for domain_name in shutdown:
        shutdown_domain = conn.lookupByName(domain_name)
        logger.info("Shutting down domain %s", domain_name)
        try:
            shutdown_domain.shutdown()
        except libvirt.libvirtError as e:
            # Ignore. Expecting this means the domain has changed state, below will
            # destroy it after timeout seconds if it was not shutting down.
            pass
        # Wait in loop
        wait_until = time.time() + 30
        while shutdown_domain.state()[0] != DomainState.SHUTOFF and time.time() < wait_until:
            time.sleep(1)
        if shutdown_domain.state()[0] != DomainState.SHUTOFF:
            logger.info("Timeout reached and domain %s has not shut off, destroying.", domain_name)
            try:
                shutdown_domain.destroy()
            except libvirt.libvirtError as e:
                # Ignore. Expecting this means the domain stopped since last check.
                pass

    if startup is not None:
        # Start up our domain of interest
        startup_domain = conn.lookupByName(startup)
        logger.info("Starting up %s", startup)
        startup_domain.create()

    if host_shutdown:
        logger.info("Attempting to shut down host.")
        subprocess.call(["/usr/bin/sudo", "/sbin/poweroff"])


@app.patch("/api/domain/{name}")
async def update_domain(name: str, action: DomainPatchModel, background_tasks: BackgroundTasks,
                        conn: libvirt.virConnect = Depends(get_conn)):
    domain = conn.lookupByName(name)
    if domain.state()[0] == DomainState.RUNNING:
        raise HTTPException(status_code=409, detail="Domain already active")
    if action.state != DomainState.RUNNING:
        raise HTTPException(status_code=400, detail="Only starting a VM is supported")
    # Make a shutdown list: currently stop everything that is not in a "SHUTOFF" state, including VM we have been asked
    # to start, potentially. Future improvement is to only shutdown VM's which are using hardware we need.
    domain_states = {x.name(): DomainState(x.state()[0]) for x in conn.listAllDomains()}
    polite_shutdown = [k for k, v in domain_states.items() if v == DomainState.RUNNING]
    hard_shutdown = [k for k, v in domain_states.items() if v != DomainState.RUNNING and v != DomainState.SHUTOFF]
    background_tasks.add_task(switch_domain, shutdown=polite_shutdown, destroy=hard_shutdown, startup=name, conn=conn,
                              host_shutdown=False)
    return {"message": "OK"}


@app.patch("/api/host")
async def update_host(action: DomainPatchModel, background_tasks: BackgroundTasks,
                      conn: libvirt.virConnect = Depends(get_conn)):
    if action.state != DomainState.SHUTOFF:
        raise HTTPException(status_code=400, detail="Only shutting down  host is supported")
    # Shut down everything!
    domain_states = {x.name(): DomainState(x.state()[0]) for x in conn.listAllDomains()}
    polite_shutdown = [k for k, v in domain_states.items() if v == DomainState.RUNNING]
    hard_shutdown = [k for k, v in domain_states.items() if v != DomainState.RUNNING and v != DomainState.SHUTOFF]
    background_tasks.add_task(switch_domain, shutdown=polite_shutdown, destroy=hard_shutdown, startup=None,
                              host_shutdown=True, conn=conn)
    return {"message": "OK"}


@app.get("/api/domain/{name}/xml")
async def get_domain_xml(name: str, conn: libvirt.virConnect = Depends(get_conn)):
    domain = conn.lookupByName(name)
    domain_xml = domain.XMLDesc()
    return Response(content=domain_xml, media_type="application/xml")


class SpaStaticFiles(StaticFiles):
    """
    Serve file if exists, otherwise index.html. Equivalent of nginx try_file.
    Based on https://stackoverflow.com/questions/64493872/how-do-i-serve-a-react-built-front-end-on-a-fastapi-backend
    """

    async def get_response(self, path: str, scope):
        try:
            # Try to serve requested file
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as ex:
            if ex.status_code == 404:
                # If it doesn't exist, serve the index instead.
                return await super().get_response("index.html", scope)
            else:
                raise ex


# Path detection differs within pyinstaller bundle
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    static_assets_path = os.path.join(getattr(sys, '_MEIPASS'), "ui/dist/ui/browser")
else:
    static_assets_path = os.path.join(os.path.dirname(__file__), "../ui/dist/ui/browser")

app.mount("/ui", SpaStaticFiles(directory=static_assets_path, html=True),
          name="spa-static-files")


@app.get("/")
async def root():
    return RedirectResponse("/ui")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
