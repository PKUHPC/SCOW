import { Migration } from "@mikro-orm/migrations";

export class Migration20260224055058 extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table `charge_record` drop index `query_info`;");

    this.addSql(
      "alter table `charge_record` add index `idx_tenant_time_acc_amt` " +
        "(`tenant_name`(64), `time`, `account_name`(64), `amount`);",
    );
    this.addSql(
      "alter table `charge_record` add index `idx_user_time_type_amt` " +
        "(`user_id`(64), `time`, `type`(32), `amount`);",
    );
    this.addSql(
      "alter table `charge_record` add index `idx_type_time_acc_amt` " +
        "(`type`(32), `time`, `account_name`(64), `amount`);",
    );
    this.addSql(
      "alter table `charge_record` add index `idx_acc_time_type_amt` " +
        "(`account_name`(64), `time`, `type`(32), `amount`);",
    );
  }

  override async down(): Promise<void> {
    this.addSql("alter table `charge_record` drop index `idx_tenant_time_acc_amt`;");
    this.addSql("alter table `charge_record` drop index `idx_user_time_type_amt`;");
    this.addSql("alter table `charge_record` drop index `idx_type_time_acc_amt`;");
    this.addSql("alter table `charge_record` drop index `idx_acc_time_type_amt`;");

    this.addSql("alter table `charge_record` add index `query_info`(`time`, `tenant_name`, `account_name`, `type`);");
  }
}
