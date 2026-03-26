import { Form, type FormInstance, Space } from "antd";
import { type ReactNode, useEffect, useRef } from "react";
import { CommandInputField } from "src/app/(auth)/jobs/CommandInputField";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import { EnvironmentVariableList } from "src/app/(auth)/jobs/EnvironmentVariableList";
import { MountPointList } from "src/app/(auth)/jobs/MountPointList";
import type { ResourceCategory } from "src/app/(auth)/jobs/ResourceSelectorList";
import { ResourceSelectorList } from "src/app/(auth)/jobs/ResourceSelectorList";
import { prefix, useI18nTranslateToString } from "src/i18n";

import { PublicImageOption } from "../../PublicImageOption";
import { DEFAULT_SERVICE_PORT } from "../LaunchInferForm";
import {
  ImageDescriptionBox,
  ImageSegmentedControl,
  ImageSelectorWrapper,
  Label,
  RoundedInput,
  RoundedInputNumber,
  RoundedPasswordInput,
  RoundedSelect,
  SectionCard,
  SectionTitle,
  SubtleCheckbox,
} from "../LaunchInferForm.styles";
import type {
  AppFormValues,
  ImageOption,
  TrainImageSourceKey,
} from "../LaunchInferForm.types";

interface ImageSourceTab {
  key: TrainImageSourceKey;
  label: string;
}

interface InferConfigSectionProps {
  form: FormInstance<AppFormValues>;
  imageSourceTabs: ImageSourceTab[];
  selectedImageSource: TrainImageSourceKey;
  onImageSourceChange: (source: TrainImageSourceKey) => void;
  imagePlaceholder: string;
  imageOptions: ImageOption[];
  isImagesLoading: boolean;
  selectedImageOption?: ImageOption;
  usePrivateRemoteImage?: boolean;
  currentCommandDefault?: string;
  modelCategories: ResourceCategory[];
  isModelsLoading: boolean;
  selectedCluster?: string;
  displayRender?: (labels: ReactNode[]) => ReactNode;
}

const pAppConfig = prefix("app.jobs.appConfigSection.");

export const InferConfigSection = ({
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
  modelCategories,
  isModelsLoading,
  selectedCluster,
  displayRender,
}: InferConfigSectionProps) => {
  const t = useI18nTranslateToString();
  const modelsPlaceholder = isModelsLoading ?
    t(pAppConfig("models.loading")) : t(pAppConfig("models.placeholder"));
  const autoFillImageKey = selectedImageOption?.value ?? `source:${selectedImageSource}`;
  const lastSyncedImageKeyRef = useRef<string | undefined>();
  const lastSyncedPortRef = useRef<number | undefined>();
  const applyContainerServicePort = (port: number) => {
    form.setFieldValue("containerServicePort", port);
    // 自动填充后立即重校验，避免保留旧的错误提示
    void form.validateFields(["containerServicePort"]).catch(() => undefined);
  };

  useEffect(() => {
    const imageServicePort = selectedImageOption?.servicePort;
    const defaultPort = (
      typeof imageServicePort === "number" && imageServicePort > 0
        ? imageServicePort
        : DEFAULT_SERVICE_PORT
    );
    const rawValue = form.getFieldValue("containerServicePort");
    const numericValue = rawValue === "" ? undefined : Number(rawValue);
    const currentValue = Number.isFinite(numericValue) ? numericValue : undefined;
    const lastKey = lastSyncedImageKeyRef.current;
    const isPlaceholderKey = lastKey?.startsWith("source:");
    const hasUserPort = currentValue !== undefined && currentValue > 0;

    if (lastKey !== autoFillImageKey) {
      lastSyncedImageKeyRef.current = autoFillImageKey;
      // 占位 key（source:xxx）切换到真实镜像 key，若已有有效端口则保留
      if ((lastKey === undefined || isPlaceholderKey) && hasUserPort) {
        lastSyncedPortRef.current = currentValue;
        return;
      }
      // 选择切换时跟随镜像端口；镜像未配置时回落到 8080
      lastSyncedPortRef.current = defaultPort;
      applyContainerServicePort(defaultPort);
      return;
    }

    if (currentValue === undefined) {
      applyContainerServicePort(defaultPort);
      lastSyncedPortRef.current = defaultPort;
      return;
    }

    if (
      lastSyncedPortRef.current !== undefined
      && currentValue === lastSyncedPortRef.current
      && currentValue !== defaultPort
    ) {
      applyContainerServicePort(defaultPort);
      lastSyncedPortRef.current = defaultPort;
      return;
    }

    lastSyncedPortRef.current = Number.isFinite(currentValue) ? currentValue : lastSyncedPortRef.current;
  }, [autoFillImageKey, form, selectedImageOption?.servicePort]);

  return (
    <SectionCard title={<SectionTitle>{t(pAppConfig("inferTitle"))}</SectionTitle>}>
      <Form
        form={form}
        colon={false}
        requiredMark={false}
      >
        <InlineFormItem
          label={(
            <Label>{t(pAppConfig("imageField.label"))}</Label>
          )}
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
                  rules={[{ required: true, message: t(pAppConfig("imageField.remoteAddressRequired")) }]}
                  style={{ marginBottom: 0 }}
                >
                  <RoundedInput
                    size="large"
                    placeholder={t(pAppConfig("imageField.remotePlaceholder"))}
                    onBlur={() => form.validateFields(["image"])}
                  />
                </Form.Item>
                <Form.Item
                  name="usePrivateImage"
                  valuePropName="checked"
                  noStyle
                >
                  <SubtleCheckbox>{t(pAppConfig("imageField.usePrivateImage"))}</SubtleCheckbox>
                </Form.Item>
                {usePrivateRemoteImage ? (
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    <Form.Item
                      name="remoteUsername"
                      noStyle
                      rules={[{ required: true, message: t(pAppConfig("imageField.remoteUsernameRequired")) }]}
                    >
                      <RoundedInput
                        size="large"
                        placeholder={t(pAppConfig("imageField.remoteUsernamePlaceholder"))}
                      />
                    </Form.Item>
                    <Form.Item
                      name="remotePassword"
                      noStyle
                      rules={[{ required: true, message: t(pAppConfig("imageField.remotePasswordRequired")) }]}
                    >
                      <RoundedPasswordInput
                        size="large"
                        placeholder={t(pAppConfig("imageField.remotePasswordPlaceholder"))}
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
                  rules={[{ required: true, message: t(pAppConfig("imageField.selectImageMessage")) }]}
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
          label={<Label>{t(pAppConfig("commandLabel"))}</Label>}
        >
          <CommandInputField defaultCommand={currentCommandDefault} />
        </InlineFormItem>

        <InlineFormItem
          name="containerServicePort"
          rules={[
            { required: true, message: t(pAppConfig("servicePortField.requiredMessage")) },
            {
              validator: (_: unknown, value: number) => {
                if (value === undefined || value === null) {
                  // 空值交给 required 规则处理，避免重复提示
                  return Promise.resolve();
                }
                const numericValue = Number(value);
                if (Number.isNaN(numericValue)) {
                  return Promise.reject(new Error(t(pAppConfig("servicePortField.invalidMessage"))));
                }
                if (numericValue <= 0 || numericValue > 65535) {
                  return Promise.reject(new Error(t(pAppConfig("servicePortField.invalidMessage"))));
                }
                return Promise.resolve();
              },
            },
          ]}
          label={<Label>{t(pAppConfig("servicePortField.containerServicePort"))}</Label>}
        >
          <RoundedInputNumber
            size="large"
            min={0}
            max={65535}
            precision={0}
            style={{ width: 160 }}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(pAppConfig("models.label"))}</Label>}
        >
          <ResourceSelectorList
            name="models"
            placeholder={modelsPlaceholder}
            addButtonText={t(pAppConfig("models.addButton"))}
            requiredMessage={t(pAppConfig("models.requiredMessage"))}
            categories={modelCategories}
            displayRender={displayRender}
          />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(pAppConfig("customMountPoints.label"))}</Label>}
          helpTip={t(pAppConfig("customMountPoints.helpTip"))}
        >
          <MountPointList clusterId={selectedCluster ?? ""} />
        </InlineFormItem>

        <InlineFormItem
          label={<Label>{t(pAppConfig("environmentVariables.label"))}</Label>}
          helpTip={t(pAppConfig("environmentVariables.helpTip"))}
        >
          <EnvironmentVariableList />
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
