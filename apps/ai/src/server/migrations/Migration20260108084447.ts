import { Migration } from "@mikro-orm/migrations";

export class Migration20260108084447 extends Migration {

  override async up(): Promise<void> {
    this.addSql("alter table `algorithm` add `is_platform_owned` tinyint(1) not null default false;");

    this.addSql("alter table `dataset` add `is_platform_owned` tinyint(1) not null default false;");

    this.addSql("alter table `image` drop index `unique_name_tag_owner`;");

    this.addSql("alter table `image` add `is_platform_owned` tinyint(1) not null default false;");
    this.addSql("alter table `image` modify `types` varchar(255) not null default 'APP,TRAIN,INFER,DEV_HOST';");
    this.addSql("alter table `image` add unique `unique_name_tag_owner`(`name`, `tag`, `owner`, `is_platform_owned`);");

    this.addSql("alter table `model` add `is_platform_owned` tinyint(1) not null default false;");
  }

  override async down(): Promise<void> {
    this.addSql("alter table `algorithm` drop column `is_platform_owned`;");

    this.addSql("alter table `dataset` drop column `is_platform_owned`;");

    this.addSql("alter table `image` drop index `unique_name_tag_owner`;");
    this.addSql("alter table `image` drop column `is_platform_owned`;");

    this.addSql("alter table `image` modify `types` varchar(255) not null default 'APP,TRAIN,INFER';");
    this.addSql("alter table `image` add unique `unique_name_tag_owner`(`name`, `tag`, `owner`);");

    this.addSql("alter table `model` drop column `is_platform_owned`;");
  }

}
