import { getLanguage } from "src/utils/i18n";

export enum NoticeType {
  SITE_MESSAGE = 0,
  SMS,
  EMAIL,
  OFFICIAL_ACCOUNT,
  WE_COM,
  DING_TALK,
  LARK,
}

export const getNoticeTypeName = (noticeType: NoticeType, languageId?: string): string => {
  const language = getLanguage(languageId);

  switch (noticeType) {
    case NoticeType.SITE_MESSAGE:
      return language.noticeType.siteMessage;
    case NoticeType.SMS:
      return language.noticeType.sms;
    case NoticeType.EMAIL:
      return language.noticeType.email;
    case NoticeType.OFFICIAL_ACCOUNT:
      return language.noticeType.officialAccount;
    case NoticeType.WE_COM:
      return language.noticeType.weCom;
    case NoticeType.DING_TALK:
      return language.noticeType.dingTalk;
    case NoticeType.LARK:
      return language.noticeType.lark;
    default:
      return "unknown";
  }
};
