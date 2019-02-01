/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { SketchSpec } from '@ephox/alloy';
import { Toolbar } from '@ephox/bridge';
import { Arr, Merger, Obj, Option } from '@ephox/katamari';
import { Editor } from 'tinymce/core/api/Editor';
import { UiFactoryBackstageShared } from 'tinymce/themes/silver/backstage/Backstage';
import { getRemovedMenuItems } from '../../../api/Settings';
import { renderCommonDropdown } from '../../dropdown/CommonDropdown';
import ItemResponse from '../item/ItemResponse';
import * as NestedMenus from '../menu/NestedMenus';
import { MenubarItemSpec } from './SilverMenubar';

export interface MenuRegistry {
  menuItems: Record<string, any>;
  menubar: string | boolean;
  menus: Record<string, any>;
}

const defaultMenubar = 'file edit view insert format tools table help';

const defaultMenus = {
  file: { title: 'File', items: 'newdocument restoredraft | preview | print | deleteallconversations' },
  edit: { title: 'Edit', items: 'undo redo | cut copy paste pastetext | selectall | searchreplace' },
  view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen | showcomments' },
  insert: { title: 'Insert', items: 'image link media addcomment pageembed template codesample inserttable | charmap emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
  format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | formats blockformats fontformats fontsizes align | removeformat' },
  tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | a11ycheck code wordcount' },
  table: { title: 'Table', items: 'inserttable tableprops deletetable row column cell' }, // TODO
  help: { title: 'Help', items: 'help' }
};

export const renderMenuButton = (spec: Toolbar.ToolbarMenuButton, prefix: string, sharedBackstage: UiFactoryBackstageShared, role: Option<string>): SketchSpec => {

  return renderCommonDropdown({
    text: spec.text,
    icon: spec.icon,
    tooltip: spec.tooltip,
     // https://www.w3.org/TR/wai-aria-practices/examples/menubar/menubar-2/menubar-2.html
    role,
    fetch: (callback) => {
      spec.fetch((items) => {
        callback(
          NestedMenus.build(items, ItemResponse.CLOSE_ON_EXECUTE, sharedBackstage.providers)
        );
      });
    },
    onAttach: () => { },
    onDetach: () => { },
    columns: 1,
    presets: 'normal',
    classes: []
  },
  prefix,
  sharedBackstage);
};

const make = (menu: {title: string, items: string[]}, registry: MenuRegistry, editor): MenubarItemSpec => {
  const removedMenuItems = getRemovedMenuItems(editor).split(/[ ,]/);
  return {
    text: menu.title,
    getItems: () => Arr.bind(menu.items, (i) => {
      if (i.trim().length === 0) {
        return [ ];
      } else if (Arr.exists(removedMenuItems, (removedMenuItem) => removedMenuItem === i)) {
        return [ ];
      } else if (i === 'separator' || i === '|') {
        return [{
          type: 'separator'
        }];
      } else if (registry.menuItems[i]) {
        return [ registry.menuItems[i] ];
      } else {
        return [ ];
      }
    })
  };
};

const parseItemsString = (items: string): string[] => {
  if (typeof items === 'string') {
    return items.split(' ');
  }
  return items;
};

const identifyMenus = (editor: Editor, registry: MenuRegistry): MenubarItemSpec[] => {
  const rawMenuData = Merger.merge(defaultMenus, registry.menus);
  const userDefinedMenus = Obj.keys(registry.menus).length > 0;

  const menubar: string[] = registry.menubar === undefined || registry.menubar === true ? parseItemsString(defaultMenubar) : parseItemsString(registry.menubar === false ? '' : registry.menubar);
  const validMenus = Arr.filter(menubar, (menuName) => {

    return userDefinedMenus ? ((registry.menus.hasOwnProperty(menuName) && registry.menus[menuName].hasOwnProperty('items')
      || defaultMenus.hasOwnProperty(menuName)))
      : defaultMenus.hasOwnProperty(menuName);
  });

  const menus: MenubarItemSpec[] = Arr.map(validMenus, (menuName) => {
    const menuData = rawMenuData[menuName];
    return make({ title: menuData.title, items: parseItemsString(menuData.items) }, registry, editor);
  });

  return Arr.filter(menus, (menu) => {
    // Filter out menus that have no items, or only separators
    const isNotSeparator = (item) => item.type !== 'separator';
    return menu.getItems().length > 0 && Arr.exists(menu.getItems(), isNotSeparator);
  });
};

export { identifyMenus };