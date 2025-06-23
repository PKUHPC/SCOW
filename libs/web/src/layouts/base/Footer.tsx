import { styled } from "styled-components";

const FooterContainer = styled.div`
  display: flex;
  justify-content: center;
  color: rgb(160, 174, 192);
  margin-bottom: 12px;
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

