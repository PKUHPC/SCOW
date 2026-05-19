import { Image, Spin } from "antd";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { styled } from "styled-components";

const FullScreenCentered = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.3);
  z-index: 1000;
`;

interface PreviewImageProps {
  visible: boolean;
  src: string;
  scaleStep: number;
}

interface Props {
  previewImage: PreviewImageProps;
  setPreviewImage: Dispatch<SetStateAction<PreviewImageProps>>;
}

export const ImagePreviewer: React.FC<Props> = ({ previewImage, setPreviewImage }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!previewImage.visible) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const img = new window.Image();
    const done = () => {
      setLoading(false);
    };
    img.onload = done;
    img.onerror = done;
    img.src = previewImage.src;
    if (img.complete) {
      done();
    }
  }, [previewImage.visible, previewImage.src]);

  return (
    <>
      {loading && previewImage.visible && (
        <FullScreenCentered>
          <Spin size="large" />
        </FullScreenCentered>
      )}
      <Image
        style={{ display: "none" }}
        src={previewImage.src}
        preview={{
          visible: previewImage.visible,
          scaleStep: previewImage.scaleStep,
          onVisibleChange: (vis) => {
            setPreviewImage({
              ...previewImage,
              visible: false,
            });

            if (!vis) {
              setLoading(false);
            }
          },
        }}
      />
    </>
  );
};
