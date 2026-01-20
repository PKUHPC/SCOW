import { Form, type FormInstance, Space } from "antd";
import type { ReactNode } from "react";
import { CommandInputField } from "src/app/(auth)/jobs/CommandInputField";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { EnvironmentVariableList } from "src/app/(auth)/jobs/EnvironmentVariableList";
import { MountPointList } from "src/app/(auth)/jobs/MountPointList";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelectorList";
import { ResourceSelectorList } from "src/app/(auth)/jobs/ResourceSelectorList";
import { prefix, useI18nTranslateToString } from "src/i18n";

import { PublicImageOption } from "../../../PublicImageOption";
import {
  ImageDescriptionBox,
  ImageSegmentedControl,
  ImageSelectorWrapper,
  Label,
  RoundedInput,
  RoundedPasswordInput,
  RoundedSelect,
  SectionCard,
  SectionTitle,
  SubtleCheckbox,
} from "../LaunchAppForm.styles";
import type {
  AppFormValues,
  ImageOption,
  ImageSourceKey,
} from "../LaunchAppForm.types";

interface ImageSourceTab {
  key: ImageSourceKey;
  label: string;
}

interface AppConfigSectionProps {
  form: FormInstance<AppFormValues>;
  imageSourceTabs: ImageSourceTab[];
  selectedImageSource: ImageSourceKey;
  onImageSourceChange: (source: ImageSourceKey) => void;
  imagePlaceholder: string;
  imageOptions: ImageOption[];
  isImagesLoading: boolean;
  selectedImageOption?: ImageOption;
  usePrivateRemoteImage?: boolean;
  currentCommandDefault?: string;
  customFormItems: ReactNode[];
  datasetCategories: ResourceCategory[];
  algorithmCategories: ResourceCategory[];
  modelCategories: ResourceCategory[];
  isDatasetsLoading: boolean;
  isAlgorithmsLoading: boolean;
  isModelsLoading: boolean;
  selectedCluster?: string;
  displayRender?: (labels: ReactNode[]) => ReactNode;
}

const p = prefix("app.jobs.appConfigSection.");

export const AppConfigSection = ({
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
  customFormItems,
  datasetCategories,
  algorithmCategories,
  modelCategories,
  isDatasetsLoading,
  isAlgorithmsLoading,
  isModelsLoading,
  selectedCluster,
  displayRender,
}: AppConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const datasetsPlaceholder = isDatasetsLoading ? t(p("datasets.loading")) : t(p("datasets.placeholder"));
  const algorithmsPlaceholder = isAlgorithmsLoading ? t(p("algorithms.loading")) : t(p("algorithms.placeholder"));
  const modelsPlaceholder = isModelsLoading ? t(p("models.loading")) : t(p("models.placeholder"));

  return (
    <SectionCard title={<SectionTitle>{t(p("title"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
      >
        <InlineFormItem
          label={(<Label>{t(p("imageField.label"))}<span style={{ color: "red", marginLeft: 4 }}>*</span></Label>)}
        >
          <ImageSelectorWrapper>
            <ImageSegmentedControl
              block
              size="large"
              options={imageSourceTabs.map(({ key, label }) => ({ label, value: key }))}
              value={selectedImageSource}
              onChange={(imageSource) => onImageSourceChange(imageSource as ImageSourceKey)}
            />

            {selectedImageSource === "remote" ? (
              <>
                <Form.Item
                  name="image"
                  rules={[{ required: true, message: t(p("imageField.remoteAddressRequired")) }]}
                  style={{ marginBottom: 0 }}
                >
                  <RoundedInput
                    size="large"
                    placeholder={t(p("imageField.remotePlaceholder"))}
                    onBlur={() => form.validateFields(["image"])}
                  />
                </Form.Item>
                <Form.Item
                  name="usePrivateImage"
                  valuePropName="checked"
                  noStyle
                >
                  <SubtleCheckbox>{t(p("imageField.usePrivateImage"))}</SubtleCheckbox>
                </Form.Item>
                {usePrivateRemoteImage ? (
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    <Form.Item
                      name="remoteUsername"
                      noStyle
                      rules={[{ required: true, message: t(p("imageField.remoteUsernameRequired")) }]}
                    >
                      <RoundedInput
                        size="large"
                        placeholder={t(p("imageField.remoteUsernamePlaceholder"))}
                      />
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
                    loading={(selectedImageSource === "mine" || selectedImageSource === "public") ?
                      isImagesLoading : false}
                    optionLabelProp="displayLabel"
                    optionRender={(option) => {
                      if (selectedImageSource !== "public") {
                        return option.label;
                      }
                      const data = option.data as ImageOption;
                      const labelText = typeof option.label === "string"
                        ? option.label
                        : `${data.rawName ?? ""}:${data.rawTag ?? ""}`;
                      const [labelName = "", labelTag = ""] = labelText.split(":").map((value) => value.trim());
                      const name = data.rawName ?? labelName;
                      const tag = data.rawTag ?? labelTag;
                      return data.displayLabel ?? (
                        <PublicImageOption
                          name={name}
                          tag={tag}
                          ownerName={data.ownerName}
                          ownerId={data.ownerId}
                        />
                      );
                    }}
                  />
                </Form.Item>
                {selectedImageOption?.description && (
                  <ImageDescriptionBox>
                    {selectedImageOption?.description}
                  </ImageDescriptionBox>
                )}
              </>
            )}
          </ImageSelectorWrapper>
        </InlineFormItem>

        <InlineFormItem
          name="command"
          label={<Label>{t(p("commandLabel"))}</Label>}
        >
          <CommandInputField defaultCommand={currentCommandDefault} />
        </InlineFormItem>

        {customFormItems}

        <InlineFormItem
          label={<Label>{t(p("datasets.label"))}</Label>}
        >
          <ResourceSelectorList
            name="datasets"
            placeholder={datasetsPlaceholder}
            addButtonText={t(p("datasets.addButton"))}
            requiredMessage={t(p("datasets.requiredMessage"))}
            categories={datasetCategories}
            displayRender={displayRender}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("algorithms.label"))}</Label>}
        >
          <ResourceSelectorList
            name="algorithms"
            placeholder={algorithmsPlaceholder}
            addButtonText={t(p("algorithms.addButton"))}
            requiredMessage={t(p("algorithms.requiredMessage"))}
            categories={algorithmCategories}
            displayRender={displayRender}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("models.label"))}</Label>}
        >
          <ResourceSelectorList
            name="models"
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
          <MountPointList clusterId={selectedCluster ?? ""} />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(p("environmentVariables.label"))}</Label>}
          helpTip={t(p("environmentVariables.helpTip"))}
        >
          <EnvironmentVariableList />
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
