# VFIO VM Switcher

Allow control of VFIO virtual machines from within VFIO virtual machines.

This is designed for situations where you have multiple VM definitions which use the same hardware, so only one can be powered on at a time.

This is a simple API which runs on the host, and allows the guest ask for itself to be shut down, and have a different VM booted up instead. This allows the user to swap between VM's without switching mouse/keyboard/monitor input to the host operating system.

## Installation notes

Substitute the username `mike` for your own username where applicable. The script assumes you are in the `libvirt` group and can control VM's.

Setup/build.

```bash
sudo apt install libvirt-dev libpython3-dev build-essential
python3 -m venv venv/
./venv/bin/pip install -r requirements.txt
./venv/bin/pyinstaller --onefile app/main.py
```

App is then at `./dist/main`

Invocation via curl:

```bash
curl -Ss -X PATCH http://192.168.122.1:8000/domain/testbox-2 -H 'Content-Type: application/json' -d '{"state" : "RUNNING"}'
```

Installation `/opt/vm-switcher`, it is installed via `/etc/systemd/system/vm-switcher.service`:

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

To allow `poweroff`, also add `/etc/sudoers.d/00-poweroff`

```
mike ALL=NOPASSWD: /sbin/halt, /sbin/reboot, /sbin/poweroff
```