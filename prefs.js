import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SwipeDownGesturePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const behavior = new Adw.PreferencesGroup({
            title: 'Gesture',
            description: 'Use a three-finger touchpad swipe down on the active workspace.',
        });

        const enabled = new Adw.SwitchRow({
            title: 'Enable gesture',
            subtitle: 'Keep native swipe-up Overview behavior.',
        });
        settings.bind('enable-gesture', enabled, 'active', Gio.SettingsBindFlags.DEFAULT);

        const selection = new Adw.ComboRow({
            title: 'Windows to minimize',
            model: Gtk.StringList.new(['All eligible windows', 'Focused window']),
        });
        const syncSelection = () => {
            selection.selected = settings.get_string('selection-mode') === 'focused' ? 1 : 0;
        };
        syncSelection();
        const settingsSelectionId = settings.connect(
            'changed::selection-mode', syncSelection);
        const rowSelectionId = selection.connect('notify::selected', () => {
            settings.set_string('selection-mode', selection.selected === 1 ? 'focused' : 'all');
        });

        const restore = new Adw.SwitchRow({
            title: 'Restore on second swipe',
            subtitle: 'Unminimize only windows hidden by this extension.',
        });
        settings.bind('restore-on-second-swipe', restore, 'active', Gio.SettingsBindFlags.DEFAULT);

        behavior.add(enabled);
        behavior.add(selection);
        behavior.add(restore);
        page.add(behavior);
        window.add(page);

        // Preferences windows are short-lived; release the two manual
        // selection connections when this page is closed.
        window.connect('close-request', () => {
            settings.disconnect(settingsSelectionId);
            selection.disconnect(rowSelectionId);
            return false;
        });
    }
}
