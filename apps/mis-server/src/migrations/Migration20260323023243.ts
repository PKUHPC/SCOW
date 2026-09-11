import { Migration } from '@mikro-orm/migrations';

export class Migration20260323023243 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`account\` add \`account_group_name\` varchar(255) null;`);
    this.addSql(`alter table \`account\` add unique \`account_account_group_name_unique\`(\`account_group_name\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`account\` drop index \`account_account_group_name_unique\`;`);
    this.addSql(`alter table \`account\` drop column \`account_group_name\`;`);
  }

}
