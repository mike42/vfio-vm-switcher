# VFIO VM Switcher

Allow control of VFIO virtual machines from within VFIO virtual machines.

This is designed for situations where you have multiple VM definitions which use the same hardware, so only one can be powered on at a time.

This is a simple API which runs on the host, and allows the guest ask for itself to be shut down, and have a different VM booted up instead. This allows the user to swap between VM's without switching mouse/keyboard/monitor input to the host operating system.

## Installation notes

Substitute the username `mike` for your own username where applicable. The script assumes you are in the `libvirt` group and can control VM's.

Build the UI first:

```bash
cd ui
npm install
npm run build
```

Next build the python bundle.

```bash
sudo apt install libvirt-dev libpython3-dev build-essential
python3 -m venv venv/
./venv/bin/pip install -r requirements.txt
./venv/bin/pyinstaller --add-data "ui/dist/:ui/dist/" --onefile app/main.py
```

App is then a binary at `./dist/main`

## Invoking API from web

When you run the app, the work-in-progress UI becomes available at http://localhost:8000/ui/.

This is a placeholder, and can't be used for VM control yet.

## Invoking API from command-line

Invocation via curl, list domains:

```bash
curl -Ss http://192.168.122.1:8000/api/domain
```

Ask for `testbox-2` to be booted up (everything else will be shut down first)

```bash
curl -Ss -X PATCH http://192.168.122.1:8000/api/domain/testbox-2 -H 'Content-Type: application/json' -d '{"state" : "RUNNING"}'
```

Ask for everything to be shut off, and for the host to be powered off.

```bash
curl -Ss -X PATCH http://192.168.122.1:8000/api/host -H 'Content-Type: application/json' -d '{"state" : "SHUTOFF"}'
```

Assuming that the binary is in `/opt/vm-switcher`, it may be installed by creating the following `/etc/systemd/system/vm-switcher.service`:

## Installation as service

```bash
[Unit]
Description=VM Switcher

[Service]
ExecStart=/opt/vm-switcher/main
WorkingDirectory=/opt/vm-switcher/
User=mike

[Install]
WantedBy=multi-user.target
```

```
systemctl daemon-reload
systemctl enable vm-switcher
systemctl start vm-switcher
```

Note that full root permissions are not required, though to allow the script to run `poweroff` on the host, you will also need to create `/etc/sudoers.d/00-poweroff`.

```
mike ALL=NOPASSWD: /sbin/halt, /sbin/reboot, /sbin/poweroff
```

## License

Except as noted below, the files in this repository is Copyright (c) 2023 Michael Billington, and may be used under the MIT license. Please see the LICENSE file in this repository for details.

The favicon used for this project's web interface is derived from `blobs-l.svg` from [gnome-backgrounds], originally by Jakub Steiner, and is licensed under Creative Commons Attribution-ShareAlike 3.0 License.
