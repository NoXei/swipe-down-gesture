import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SwipeDownGesturePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const behavior = new Adw.PreferencesGroup({
            title: 'Gesture',
            description: 'Swipe down with three fingers for the focused window, or four fingers for all windows.',
        });

        const enabled = new Adw.SwitchRow({
            title: 'Enable gesture',
            subtitle: 'Keep native swipe-up Overview behavior.',
        });
        settings.bind('enable-gesture', enabled, 'active', Gio.SettingsBindFlags.DEFAULT);

        const restore = new Adw.SwitchRow({
            title: 'Restore when the desktop is clear',
            subtitle: 'Unminimize only windows hidden by this extension.',
        });
        settings.bind('restore-on-second-swipe', restore, 'active', Gio.SettingsBindFlags.DEFAULT);

        behavior.add(enabled);
        behavior.add(restore);
        page.add(behavior);
        window.add(page);
    }
}
