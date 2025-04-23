import { Divider } from "antd";
import { styled } from "styled-components";

const FooterContainer = styled.div`
  display: flex;
  justify-content: center;

  margin-bottom: 8px;
  // https://v1.tailwindcss.com/docs/text-color text-gray-500
  color: #a0aec0;
`;

interface Props {
  text: string | undefined;
  versionTag: string | undefined;
}

export const Footer: React.FC<Props> = ({ text, versionTag }) => {

  return (
    <>
      {
        text === "" ? "" : (
          <>
            <Divider style={{ marginTop: 0, marginBottom: 10 }} />
            {
              text === undefined ? (
                <FooterContainer>
                  <span>Powered by&nbsp;
                    <a href="https://www.pkuscow.com" target="_blank">
                      SCOW {versionTag || ""}
                    </a>
                  </span>
                </FooterContainer>
              ) : (
                <FooterContainer
                  dangerouslySetInnerHTML={{ __html: text }}
                />
              )
            }
          </>
        )
      }
    </>
  );
};

