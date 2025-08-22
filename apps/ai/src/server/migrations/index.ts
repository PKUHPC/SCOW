/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Migration20240102091246 } from "./Migration20240102091246";
import { Migration20240103020827 } from "./Migration20240103020827";
import { Migration20240103024536 } from "./Migration20240103024536";
import { Migration20240103072610 } from "./Migration20240103072610";
import { Migration20240112074625 } from "./Migration20240112074625";
import { Migration20240126070152 } from "./Migration20240126070152";
import { Migration20240129034339 } from "./Migration20240129034339";
import { Migration20240131083455 } from "./Migration20240131083455";
import { Migration20241227021546 } from "./Migration20241227021546";
import { Migration20250618075022 } from "./Migration20250618075022";
import { Migration20250819030518 } from "./Migration20250819030518";
import { MigrationImageData20250819 } from "./MigrationImageData20250819";


export const migrations =
[
  Migration20240102091246,
  Migration20240103024536,
  Migration20240103020827,
  Migration20240103072610,
  Migration20240112074625,
  Migration20240126070152,
  Migration20240129034339,
  Migration20240131083455,
  Migration20241227021546,
  Migration20250618075022,
  MigrationImageData20250819,
  Migration20250819030518,
].map((x) => ({ name: x.name, class: x }));
