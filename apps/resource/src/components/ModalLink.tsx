"use client";

import { Button, ButtonProps } from "antd";
import React, { useEffect, useState } from "react";

export interface CommonModalProps {
  open: boolean;
  onClose: () => void;
}

interface ExternalControlProps {
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

export const ModalButton =
  <T,>(ModalComponent: React.ComponentType<CommonModalProps & T>, buttonProps?: ButtonProps) =>
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

    return (
      <>
        <Button onClick={handleToggle} {...buttonProps}>
          {children}
        </Button>
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
