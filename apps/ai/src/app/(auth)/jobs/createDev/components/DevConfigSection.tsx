import { Checkbox } from "@scow/lib-web/build/components/styledAntdCom/Checkbox";
import { FormLabel as Label } from "@scow/lib-web/build/components/styledAntdCom/Form";
import { RoundedInput, RoundedPasswordInput } from "@scow/lib-web/build/components/styledAntdCom/Input";
import { RoundedSelect } from "@scow/lib-web/build/components/styledAntdCom/Select";
import {
  SectionTitle,
  TitledSectionCard as SectionCard,
} from "@scow/lib-web/build/components/styledAntdCom/TitledSectionCard";
import { Form, type FormInstance, Space } from "antd";
import { InlineFormItem } from "src/app/(auth)/jobs/CustomFormItem";
import {
  ImageDescriptionBox,
  ImageSegmentedControl,
  ImageSelectorWrapper,
} from "src/app/(auth)/jobs/LaunchJobForm.styles";
import { MountPointList } from "src/app/(auth)/jobs/MountPointList";
import { PublicImageOption } from "src/app/(auth)/jobs/PublicImageOption";
import { prefix, useI18nTranslateToString } from "src/i18n";

import type { AppFormValues, DevImageSourceKey, ImageOption } from "../LaunchDevForm.types";

interface ImageSourceTab {
  key: DevImageSourceKey;
  label: string;
}

interface AppConfigSectionProps {
  form: FormInstance<AppFormValues>;
  imageSourceTabs: ImageSourceTab[];
  selectedImageSource: DevImageSourceKey;
  onImageSourceChange: (source: DevImageSourceKey) => void;
  imagePlaceholder: string;
  imageOptions: ImageOption[];
  isImagesLoading: boolean;
  selectedImageOption?: ImageOption;
  usePrivateRemoteImage?: boolean;
  selectedCluster?: string;
}

const p = prefix("app.jobs.appConfigSection.");

export const DevConfigSection = ({
  form,
  imageSourceTabs,
  selectedImageSource,
  onImageSourceChange,
  imagePlaceholder,
  imageOptions,
  isImagesLoading,
  selectedImageOption,
  usePrivateRemoteImage,
  selectedCluster,
}: AppConfigSectionProps) => {
  const t = useI18nTranslateToString();

  return (
    <SectionCard title={<SectionTitle>{t(p("devTitle"))}</SectionTitle>}>
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
              onChange={(imageSource) => onImageSourceChange(imageSource as DevImageSourceKey)}
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

        <InlineFormItem
          label={<Label>{t(p("customMountPoints.label"))}</Label>}
          helpTip={t(p("customMountPoints.helpTip"))}
        >
          <MountPointList clusterId={selectedCluster ?? ""} />
        </InlineFormItem>
      </Form>
    </SectionCard>
  );
};
