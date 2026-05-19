import { Migration } from "@mikro-orm/migrations";

export class Migration20240118021127 extends Migration {
  async up(): Promise<void> {
    this.addSql("alter table `charge_record` add `user_id` varchar(255) null, add `metadata` json null;");
    this.addSql("alter table `charge_record` add index `time`(`time`);");
    this.addSql("alter table `charge_record` add index `charge_record_tenant_name_index`(`tenant_name`);");
    this.addSql("alter table `charge_record` add index `charge_record_account_name_index`(`account_name`);");
    this.addSql("alter table `charge_record` add index `charge_record_user_id_index`(`user_id`);");
    this.addSql("alter table `charge_record` add index `charge_record_type_index`(`type`);");

    this.addSql("alter table `tenant` modify `create_time` DATETIME(6) not null default current_timestamp(6);");

    this.addSql("alter table `user` modify `create_time` DATETIME(6) not null default current_timestamp(6);");
  }

  async down(): Promise<void> {
    this.addSql("alter table `charge_record` drop index `time`;");
    this.addSql("alter table `charge_record` drop index `charge_record_tenant_name_index`;");
    this.addSql("alter table `charge_record` drop index `charge_record_account_name_index`;");
    this.addSql("alter table `charge_record` drop index `charge_record_user_id_index`;");
    this.addSql("alter table `charge_record` drop index `charge_record_type_index`;");
    this.addSql("alter table `charge_record` drop `user_id`;");
    this.addSql("alter table `charge_record` drop `metadata`;");

    this.addSql("alter table `tenant` modify `create_time` DATETIME(6) not null default current_timestamp(0);");

    this.addSql("alter table `user` modify `create_time` DATETIME(6) not null default current_timestamp(0);");
  }
}
