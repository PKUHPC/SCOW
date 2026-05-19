import { Migration } from "@mikro-orm/migrations";
/* eslint-disable @stylistic/max-len */

export class Migration20250618075022 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      "alter table `image` add `types` varchar(255) not null default 'APP,TRAIN,INFER', add `infer_service_port` varchar(255) null, add `start_command` TEXT null;",
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      "alter table `image` drop column `types`, drop column `infer_service_port`, drop column `start_command`;",
    );
  }
}
