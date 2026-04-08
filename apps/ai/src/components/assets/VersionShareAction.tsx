import { ModalFuncProps } from "antd";
import React from "react";
import { CancelShareIcon, ShareIcon } from "src/icons/operationIcon";
import { SharedStatus } from "src/models/common";

type ToggleIconComponent = React.ComponentType<{ disabled?: boolean }>;

interface Props {
  sharedStatus: SharedStatus;
  confirmTitle: string;
  confirmContent: string;
  confirmAction: (config: ModalFuncProps) => void;
  onShare: () => Promise<void>;
  onUnshare: () => Promise<void>;
  sharedIcon?: ToggleIconComponent;
  unsharedIcon?: ToggleIconComponent;
}

export const VersionShareAction: React.FC<Props> = ({
  sharedStatus,
  confirmTitle,
  confirmContent,
  confirmAction,
  onShare,
  onUnshare,
  sharedIcon: SharedIcon = CancelShareIcon,
  unsharedIcon: UnsharedIcon = ShareIcon,
}) => {
  const isSharedState = sharedStatus === SharedStatus.SHARED || sharedStatus === SharedStatus.UNSHARING;
  const isDisabled = sharedStatus === SharedStatus.SHARING || sharedStatus === SharedStatus.UNSHARING;

  const onClick = () => {
    if (isDisabled) {
      return;
    }

    confirmAction({
      title: confirmTitle,
      content: confirmContent,
      onOk: async () => {
        if (sharedStatus === SharedStatus.SHARED) {
          await onUnshare();
        } else {
          await onShare();
        }
      },
    });
  };

  return (
    <span onClick={onClick}>
      {isSharedState ? (
        <SharedIcon disabled={sharedStatus === SharedStatus.UNSHARING} />
      ) : (
        <UnsharedIcon disabled={sharedStatus === SharedStatus.SHARING} />
      )}
    </span>
  );
};
