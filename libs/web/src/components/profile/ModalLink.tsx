import { Button, type ButtonProps } from "antd";
import React, { useEffect, useState } from "react";

export interface CommonModalProps {
  open: boolean;
  onClose: () => void;
}

export interface ExternalControlProps {
  externalOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export const ModalLink =
  <T,>(ModalComponent: React.ComponentType<CommonModalProps & T>) =>
  (props: React.PropsWithChildren<Omit<T, keyof CommonModalProps>>) => {
    const [open, setOpen] = useState(false);
    const { children, ...rest } = props;

    return (
      <>
        <a onClick={() => setOpen(true)}>{children}</a>
        {/** @ts-ignore */}
        <ModalComponent
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          {...rest}
        />
      </>
    );
  };

export const createModalButton =
  <ButtonComponentProps extends { onClick?: React.MouseEventHandler }>(
    ButtonComponent: React.ComponentType<React.PropsWithChildren<ButtonComponentProps>>,
  ) =>
  <T,>(ModalComponent: React.ComponentType<CommonModalProps & T>, buttonProps?: ButtonComponentProps) =>
  (props: React.PropsWithChildren<Omit<T, keyof CommonModalProps> & ExternalControlProps>) => {
    const [open, setOpen] = useState(false);
    const { children, externalOpen, onToggle, ...rest } = props;

    useEffect(() => {
      if (externalOpen !== undefined) {
        setOpen(externalOpen);
      }
    }, [externalOpen]);

    const handleToggle = () => {
      const newState = !open;
      setOpen(newState);
      if (onToggle) {
        onToggle(newState);
      }
    };

    const resolvedButtonProps = {
      onClick: handleToggle,
      ...buttonProps,
      children,
    } as React.PropsWithChildren<ButtonComponentProps>;

    return (
      <>
        <ButtonComponent {...resolvedButtonProps} />
        {/** @ts-ignore */}
        <ModalComponent
          open={open}
          onClose={() => {
            setOpen(false);
            if (onToggle) {
              onToggle(false);
            }
          }}
          {...rest}
        />
      </>
    );
  };

export const ModalButton = createModalButton<ButtonProps>(Button);
