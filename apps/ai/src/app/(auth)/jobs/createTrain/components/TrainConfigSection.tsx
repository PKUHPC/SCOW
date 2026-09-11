import type { ReactNode } from "react";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelector.shared";

import { Checkbox } from "@scow/lib-web/build/components/styledAntdCom/Checkbox";
import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput, RoundedPasswordInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import {
  SectionTitle,
  TitledSectionCard as SectionCard,
} from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { createHomeScopedPathValidator } from "@scow/lib-web/build/utils/form";
import { Form, type FormInstance, Space, Switch } from "antd";
import { CommandInputField } from "src/app/(auth)/jobs/CommandInputField";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { EnvVariableFormSection } from "src/app/(auth)/jobs/EnvVariableFormSection";
import {
  ImageDescriptionBox,
  ImageSegmentedControl,
  ImageSelectorWrapper,
} from "src/app/(auth)/jobs/LaunchJobForm.styles";
import { MountPointList } from "src/app/(auth)/jobs/MountPointList";
import { PublicImageOption } from "src/app/(auth)/jobs/PublicImageOption";
import { RESOURCE_MOUNT_TYPES, ResourceSelectorList } from "src/app/(auth)/jobs/ResourceSelectorList";
import { useClusterEntryPathRoots } from "src/app/(auth)/jobs/useClusterEntryPathRoots";
import { FileSelectModal } from "src/components/FileSelectModal";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { createImageAddressValidator } from "src/utils/form";
import { useTheme } from "styled-components";

import type { ImageOption, TrainAppFormValues, TrainImageSourceKey } from "../LaunchTrainForm.types";

interface ImageSourceTab {
  key: TrainImageSourceKey;
  label: string;
}

interface AppConfigSectionProps {
  form: FormInstance<TrainAppFormValues>;
  imageSourceTabs: ImageSourceTab[];
  selectedImageSource: TrainImageSourceKey;
  onImageSourceChange: (source: TrainImageSourceKey) => void;
  imagePlaceholder: string;
  imageOptions: ImageOption[];
  isImagesLoading: boolean;
  selectedImageOption?: ImageOption;
  usePrivateRemoteImage?: boolean;
  currentCommandDefault?: string;
  datasetCategories: ResourceCategory[];
  algorithmCategories: ResourceCategory[];
  modelCategories: ResourceCategory[];
  isDatasetsLoading: boolean;
  isAlgorithmsLoading: boolean;
  isModelsLoading: boolean;
  selectedCluster?: string;
  displayRender?: (labels: ReactNode[]) => ReactNode;
  homeDir?: string;
}

const p = prefix("app.jobs.appConfigSection.");
const pPathValidation = prefix("common.pathValidation.");

export const TrainConfigSection = ({
  form,
  imageSourceTabs,
  selectedImageSource,
  onImageSourceChange,
  imagePlaceholder,
  imageOptions,
  isImagesLoading,
  selectedImageOption,
  usePrivateRemoteImage,
  currentCommandDefault,
  datasetCategories,
  algorithmCategories,
  modelCategories,
  isDatasetsLoading,
  isAlgorithmsLoading,
  isModelsLoading,
  selectedCluster,
  displayRender,
  homeDir,
}: AppConfigSectionProps) => {
  const theme = useTheme();
  const t = useI18nTranslateToString();
  const datasetsPlaceholder = isDatasetsLoading ? t(p("datasets.loading")) : t(p("datasets.placeholder"));
  const algorithmsPlaceholder = isAlgorithmsLoading ? t(p("algorithms.loading")) : t(p("algorithms.placeholder"));
  const modelsPlaceholder = isModelsLoading ? t(p("models.loading")) : t(p("models.placeholder"));
  const needTensorBoard = Form.useWatch<boolean>("needTensorBoard", form) ?? false;
  const clusterId = selectedCluster ?? "";
  const trustedRootPaths = useClusterEntryPathRoots(selectedCluster);
  const controlHeightLg = Math.max(theme.token.controlHeightLG ?? 40, 42);

  return (
    <SectionCard title={<SectionTitle>{t(p("trainTitle"))}</SectionTitle>}>
      <Form form={form} colon={false} requiredMark={false}>
        <InlineFormItem
          label={
            <Label>
              {t(p("imageField.label"))}
              <span style={{ color: "red", marginLeft: 4 }}>*</span>
            </Label>
          }
        >
          <ImageSelectorWrapper>
            <ImageSegmentedControl
              block
              size="large"
              options={imageSourceTabs.map(({ key, label }) => ({ label, value: key }))}
              value={selectedImageSource}
              onChange={(imageSource) => onImageSourceChange(imageSource as TrainImageSourceKey)}
            />

            {selectedImageSource === "remote" ? (
              <>
                <Form.Item
                  name="image"
                  rules={[
                    { required: true, message: t(p("imageField.remoteAddressRequired")) },
                    createImageAddressValidator(t(p("imageField.remoteAddressInvalid"))),
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <RoundedInput
                    size="large"
                    placeholder={t(p("imageField.remotePlaceholder"))}
                    onBlur={() => form.validateFields(["image"])}
                  />
                </Form.Item>
                <Form.Item name="usePrivateImage" valuePropName="checked" noStyle>
                  <Checkbox>{t(p("imageField.usePrivateImage"))}</Checkbox>
                </Form.Item>
                {usePrivateRemoteImage ? (
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    <Form.Item
                      name="remoteUsername"
                      noStyle
                      rules={[{ required: true, message: t(p("imageField.remoteUsernameRequired")) }]}
                    >
                      <RoundedInput size="large" placeholder={t(p("imageField.remoteUsernamePlaceholder"))} />
                    </Form.Item>
                    <Form.Item
                      name="remotePassword"
                      noStyle
                      rules={[{ required: true, message: t(p("imageField.remotePasswordRequired")) }]}
                    >
                      <RoundedPasswordInput
                        size="large"
                        placeholder={t(p("imageField.remotePasswordPlaceholder"))}
                        visibilityToggle
                      />
                    </Form.Item>
                  </Space>
                ) : null}
              </>
            ) : (
              <>
                <Form.Item
                  name="image"
                  rules={[{ required: true, message: t(p("imageField.selectImageMessage")) }]}
                  style={{ marginBottom: 0 }}
                >
                  <RoundedSelect
                    size="large"
                    placeholder={imagePlaceholder}
                    options={imageOptions}
                    style={{ width: "100%" }}
                    loading={
                      selectedImageSource === "mine" || selectedImageSource === "public" ? isImagesLoading : false
                    }
                    optionLabelProp="displayLabel"
                    optionRender={(option) => {
                      if (selectedImageSource !== "public") {
                        return option.label;
                      }
                      const data = option.data as ImageOption;
                      const labelText =
                        typeof option.label === "string" ? option.label : `${data.rawName ?? ""}:${data.rawTag ?? ""}`;
                      const [labelName = "", labelTag = ""] = labelText.split(":").map((value) => value.trim());
                      const name = data.rawName ?? labelName;
                      const tag = data.rawTag ?? labelTag;
                      return (
                        data.displayLabel ?? (
                          <PublicImageOption name={name} tag={tag} ownerName={data.ownerName} ownerId={data.ownerId} />
                        )
                      );
                    }}
                  />
                </Form.Item>
                {selectedImageOption?.description && (
                  <ImageDescriptionBox>{selectedImageOption?.description}</ImageDescriptionBox>
                )}
              </>
            )}
          </ImageSelectorWrapper>
        </InlineFormItem>

        <InlineFormItem name="command" label={<Label>{t(p("commandLabel"))}</Label>}>
          <CommandInputField defaultCommand={currentCommandDefault} />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("datasets.label"))}</Label>}
          helpTip={t("app.jobs.appConfigSection.environmentVariables.datasetHelpTip")}
        >
          <ResourceSelectorList
            name="datasets"
            resourceType={RESOURCE_MOUNT_TYPES.DATASET}
            placeholder={datasetsPlaceholder}
            addButtonText={t(p("datasets.addButton"))}
            requiredMessage={t(p("datasets.requiredMessage"))}
            categories={datasetCategories}
            displayRender={displayRender}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("algorithms.label"))}</Label>}
          helpTip={t("app.jobs.appConfigSection.environmentVariables.algorithmHelpTip")}
        >
          <ResourceSelectorList
            name="algorithms"
            resourceType={RESOURCE_MOUNT_TYPES.ALGORITHM}
            placeholder={algorithmsPlaceholder}
            addButtonText={t(p("algorithms.addButton"))}
            requiredMessage={t(p("algorithms.requiredMessage"))}
            categories={algorithmCategories}
            displayRender={displayRender}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("models.label"))}</Label>}
          helpTip={t("app.jobs.appConfigSection.environmentVariables.modelHelpTip")}
        >
          <ResourceSelectorList
            name="models"
            resourceType={RESOURCE_MOUNT_TYPES.MODEL}
            placeholder={modelsPlaceholder}
            addButtonText={t(p("models.addButton"))}
            requiredMessage={t(p("models.requiredMessage"))}
            categories={modelCategories}
            displayRender={displayRender}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("customMountPoints.label"))}</Label>}
          helpTip={t(p("customMountPoints.helpTip"))}
        >
          <MountPointList clusterId={selectedCluster ?? ""} homeDir={homeDir} />
        </InlineFormItem>

        <EnvVariableFormSection clusterId={selectedCluster} homeDir={homeDir} />

        <InlineFormItem label={<Label>{t(p("tensorBoard.label"))}</Label>}>
          <div style={{ width: "60%", minHeight: controlHeightLg, display: "flex", alignItems: "center", gap: 12 }}>
            <Form.Item
              name="needTensorBoard"
              valuePropName="checked"
              getValueProps={(value: boolean | undefined) => ({ checked: value })}
              getValueFromEvent={(checked: boolean) => checked}
              noStyle
            >
              <Switch />
            </Form.Item>
            {needTensorBoard ? (
              <Form.Item
                name="tensorBoardDataPath"
                style={{ flex: 1, marginBottom: 0 }}
                rules={[
                  { required: true, message: t(p("tensorBoard.dataPathRequired")) },
                  createHomeScopedPathValidator(
                    homeDir,
                    {
                      unsafeCharacter: t(pPathValidation("unsafeCharacter")),
                      pathTraversal: t(pPathValidation("pathTraversal")),
                      currentDirectory: t(pPathValidation("currentDirectory")),
                      absoluteRequired: t(pPathValidation("absoluteRequired")),
                      homeDirRequired: t(pPathValidation("homeDirRequired")),
                      notInHomeDir: t("app.jobs.mountPointList.notInHomeDir"),
                    },
                    trustedRootPaths,
                  ),
                ]}
              >
                <RoundedInput
                  size="large"
                  disabled
                  placeholder={t(p("tensorBoard.dataPathPlaceholder"))}
                  prefix={
                    <FileSelectModal
                      allowedFileType={["DIR"]}
                      onSubmit={(path: string) => {
                        form.setFieldValue("tensorBoardDataPath", path);
                        form.validateFields(["tensorBoardDataPath"]);
                      }}
                      clusterId={clusterId}
                    />
                  }
                />
              </Form.Item>
            ) : null}
          </div>
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
