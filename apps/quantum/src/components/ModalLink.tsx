"use client";

import { Button, ButtonProps } from "antd";
import React, { useState } from "react";

export interface CommonModalProps {
  open: boolean;
  onClose: () => void;
}

export const ModalLink = <T,>(
  ModalComponent: React.ComponentType<CommonModalProps & T>,
) => (props: React.PropsWithChildren<Omit<T, keyof CommonModalProps>>) => {
  const [open, setOpen] = useState(false);
  const { children, ...rest } = props;

  return (
    <>
      <a onClick={() => setOpen(true)}>
        {children}
      </a>
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


export const ModalButton = <T,>(
  ModalComponent: React.ComponentType<CommonModalProps & T>,
  buttonProps?: ButtonProps,
) => (props: React.PropsWithChildren<Omit<T, keyof CommonModalProps>>) => {
  const [open, setOpen] = useState(false);
  const { children, ...rest } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)} {...buttonProps}>
        {children}
      </Button>
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
