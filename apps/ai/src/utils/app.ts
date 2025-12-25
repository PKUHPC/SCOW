import { FormInstance } from "antd";
import { TextsTransType } from "src/models/Algorithm";
import { IdPrivate } from "src/server/trpc/route/jobs/jobs";

export const getIdPrivate = (array?: IdPrivate[]) =>
  (array ?? []).reduce<{
    ids: number[];
    isPrivates: boolean[];
  }>(
    (acc, item) => {
      acc.ids.push(item.id);
      acc.isPrivates.push(item.isPrivate);
      return acc;
    },
    { ids: [], isPrivates: []},
  );


interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

// 在作业详情页面，向表单的 selectedNameVersion 中
// set 数据集:版本 或 算法：版本 或 模型：版本 的名称
export const setJobCreationNameVersion = <T extends Record<string, any>>(
  formName: "algorithmArray" | "datasetArray" | "modelArray",
  form: FormInstance<T>,
  index: number,
  nameOptions: SelectOption[],
  versionOptions: SelectOption[],
  onChangedValue: number,
  t: TextsTransType,
) => {
  const selectedName: string = form.getFieldValue([formName, index, "name"]);
  const nameOption = nameOptions.find((option) => option.value === selectedName);
  const versionOption = versionOptions.find((option) => option.value === onChangedValue);
  if (nameOption && versionOption) {
    // 从label中提取元素纯名称, 去掉末尾的owner
    const i18nVersionTag = t("app.jobs.launchAppForm.versionTag");
    const pureName = nameOption.label.replace(/\([^)]*\)$/, "");
    const selectedNameVersion = `${pureName}（${i18nVersionTag}：${versionOption.label}）`;
    form.setFieldValue([formName, index, "selectedNameVersion"], selectedNameVersion);
  }
};
