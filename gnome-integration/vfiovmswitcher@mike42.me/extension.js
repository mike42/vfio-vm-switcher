/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const session = new Soup.Session();

const API_ROOT = 'http://192.168.122.1:8000'

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('My Shiny Indicator'));

        this.add_child(new St.Icon({
            icon_name: 'media-playlist-repeat',
            style_class: 'system-status-icon',
        }));

        let message = Soup.Message.new(
            'GET',
            API_ROOT + '/api/domain'
        );

        session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                if (message.get_status() === Soup.Status.OK) {
                    let bytes = session.send_and_read_finish(result);
                    let decoder = new TextDecoder('utf-8');
                    let response = decoder.decode(bytes.get_data());
                    let parsedResponse = JSON.parse(response);
                    parsedResponse.forEach((domain) => {
                        let item = new PopupMenu.PopupMenuItem(_(domain.title));
                        if(domain.state == "RUNNING") {
                             // TODO: Grey out current domain.
                        }
                        item.connect('activate', () => {
                            // Send request to host
                            let switchMessage = Soup.Message.new(
                                'PATCH',
                                API_ROOT + '/api/domain/' + domain.name
                            );
                            let bodyStr = JSON.stringify({ state: "RUNNING"});
                            let encoder = new TextEncoder();
                            let bodyByteArray = encoder.encode(bodyStr);
                            let bodyBytes = new GLib.Bytes(bodyByteArray);
                            switchMessage.set_request_body_from_bytes('application/json', bodyBytes);
                            session.send_and_read_async(
                                switchMessage,
                                GLib.PRIORITY_DEFAULT,
                                null,
                                (session, result) => {
                                    Main.notify(_('Switching to ' + domain.title));
                                }
                            );
                        });
                        this.menu.addMenuItem(item);
                    });
                }
            }
        );
        // Menu item to shut off host
        let hostShutdownItem = new PopupMenu.PopupMenuItem(_("Host shutdown"));
        hostShutdownItem.connect('activate', () => {
            // Send request to host
            let switchMessage = Soup.Message.new(
                'PATCH',
                API_ROOT + '/api/host'
            );
            let bodyStr = JSON.stringify({ state: "SHUTOFF"});
            let encoder = new TextEncoder();
            let bodyByteArray = encoder.encode(bodyStr);
            let bodyBytes = new GLib.Bytes(bodyByteArray);
            switchMessage.set_request_body_from_bytes('application/json', bodyBytes);
            session.send_and_read_async(
                switchMessage,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    Main.notify(_('Shutting off host'));
                }
            );
        });
        this.menu.addMenuItem(hostShutdownItem);
    }
});

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
