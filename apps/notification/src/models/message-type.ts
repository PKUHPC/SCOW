export interface Template {
  default: string;
  en?: string;
  zhCn?: string;
  fr?: string;
  de?: string;
  es?: string;
  ja?: string;
  ko?: string;
  pt?: string;
  ru?: string;
}
// 定义 messageTypesMap 的值类型
export interface MessageTypeInfo {
  type: string;
  titleTemplate: Template;
  category: string;
  categoryTemplate: Template;
  contentTemplate: Template;
}

export enum InternalMessageType {
  AccountOverdue = "AccountOverdue",
  AccountRechargeSuccess = "AccountRechargeSuccess",
  AccountLowBalance = "AccountLowBalance",
  AccountBalance = "AccountBalance",
  AccountLocked = "AccountLocked",
  AccountUnblocked = "AccountUnblocked",
  JobStarted = "JobStarted",
  JobFinished = "JobFinished",
  JobAbnormalTermination = "JobAbnormalTermination",
  AccountUserSyncResult = "AccountUserSyncResult",
  MonitorAlert = "MonitorAlert",
}

export enum AdminMessageType {
  SystemNotification = "SystemNotification",
}

export const adminMessageTypesMap = new Map<AdminMessageType, MessageTypeInfo>([
  [
    AdminMessageType.SystemNotification,
    {
      type: "SystemNotification",
      titleTemplate: {
        default: "系统公告",
        en: "System Notification",
        de: "Systembenachrichtigung",
        es: "Notificación del sistema",
        fr: "Annonce système",
        ja: "システム通知",
        ko: "시스템 공지",
        pt: "Notificação do sistema",
        ru: "Системное уведомление",
        zhCn: "系统公告",
      },
      category: "Admin",
      categoryTemplate: {
        default: "Admin Messages",
        en: "Admin Messages",
        de: "Administratornachrichten",
        es: "Mensajes de administrador",
        fr: "Messages administrateur",
        ja: "管理者メッセージ",
        ko: "관리자 메시지",
        pt: "Mensagens de administrador",
        ru: "Сообщения администратора",
        zhCn: "管理员消息",
      },
      contentTemplate: {
        default: "",
      },
    },
  ],
]);

// 使用 enum 作为 map 的 key 的类型
export const internalMessageTypesMap = new Map<InternalMessageType, MessageTypeInfo>([
  // Account
  [
    InternalMessageType.AccountOverdue,
    {
      type: "AccountOverdue",
      titleTemplate: {
        default: "欠费通知",
        en: "Account Overdue",
        de: "Kontozahlung im Verzug",
        es: "Cuenta en mora",
        fr: "Compte en retard de paiement",
        ja: "支払い遅延通知",
        ko: "계정 연체",
        pt: "Conta em atraso",
        ru: "Просрочка по счёту",
        zhCn: "欠费通知",
      },
      category: "Account",
      categoryTemplate: {
        default: "账户消息",
        en: "Account Messages",
        de: "Kontonachrichten",
        es: "Mensajes de cuenta",
        fr: "Messages du compte",
        ja: "アカウントメッセージ",
        ko: "계정 메시지",
        pt: "Mensagens da conta",
        ru: "Сообщения счёта",
        zhCn: "账户消息",
      },
      contentTemplate: {
        default: "截至【{__time__}】，账户 {__accountName__} 已经欠费 {__amount__} 元，请及时交费。",
        en: "As of [{__time__}], the account {__accountName__} has owed {__amount__} yuan. Please pay the fee in time.",
        de:
          "Zum Zeitpunkt [{__time__}] hat das Konto {__accountName__} einen Rückstand von {__amount__} Yuan. " +
          "Bitte zahlen Sie rechtzeitig.",
        es:
          "A [{__time__}], la cuenta {__accountName__} tiene una deuda de {__amount__} yuanes. " +
          "Por favor pague a tiempo.",
        fr:
          "À [{__time__}], le compte {__accountName__} a une dette de {__amount__} yuan. " +
          "Veuillez payer rapidement.",
        ja:
          "[{__time__}] 現在、アカウント {__accountName__} は {__amount__} 元の未払いがあります。" +
          " 速やかにお支払いください。",
        ko:
          "[{__time__}] 기준, 계정 {__accountName__} 에 {__amount__} 위안의 연체가 있습니다. " +
          "빠른 납부를 부탁드립니다.",
        pt:
          "Em [{__time__}], a conta {__accountName__} possui atraso de {__amount__} yuan. " +
          "Por favor, pague o quanto antes.",
        ru:
          "На [{__time__}] по счёту {__accountName__} задолженность {__amount__} юаней. " +
          "Пожалуйста, оплатите вовремя.",
        zhCn: "截至【{__time__}】，账户 {__accountName__} 已经欠费 {__amount__} 元，请及时交费。",
      },
    },
  ],
  [
    InternalMessageType.AccountRechargeSuccess,
    {
      type: "AccountRechargeSuccess",
      titleTemplate: {
        default: "充值成功通知",
        en: "Account Recharge Success",
        de: "Konto erfolgreich aufgeladen",
        es: "Recarga de cuenta exitosa",
        fr: "Rechargement du compte réussi",
        ja: "アカウントのチャージ成功",
        ko: "계정 충전 성공",
        pt: "Recarga da conta bem‑sucedida",
        ru: "Пополнение счёта успешно",
        zhCn: "充值成功通知",
      },
      category: "Account",
      categoryTemplate: {
        default: "账户消息",
        en: "Account Messages",
        de: "Kontonachrichten",
        es: "Mensajes de cuenta",
        fr: "Messages du compte",
        ja: "アカウントメッセージ",
        ko: "계정 메시지",
        pt: "Mensagens da conta",
        ru: "Сообщения счёта",
        zhCn: "账户消息",
      },
      contentTemplate: {
        default:
          "账户 {__accountName__} 已于【{__time__}】成功充值 {__chargeAmount__} 元，当前余额为 {__amount__} 元。",
        en:
          "The account {__accountName__} has been successfully topped up with {__chargeAmount__} yuan at [{__time__}]. " +
          "The current balance is {__amount__} yuan.",
        de:
          "Das Konto {__accountName__} wurde am [{__time__}] um {__chargeAmount__} Yuan aufgeladen. " +
          "Aktueller Kontostand: {__amount__} Yuan.",
        es:
          "La cuenta {__accountName__} fue recargada con {__chargeAmount__} yuanes el [{__time__}]. " +
          "El saldo actual es {__amount__} yuanes.",
        fr:
          "Le compte {__accountName__} a été rechargé de {__chargeAmount__} yuan le [{__time__}]. " +
          "Le solde actuel est de {__amount__} yuan.",
        ja:
          "アカウント {__accountName__} は [{__time__}] に {__chargeAmount__} 元がチャージされました。" +
          " 現在の残高は {__amount__} 元です。",
        ko:
          "계정 {__accountName__} 는 [{__time__}] 에 {__chargeAmount__} 위안을 충전했습니다. " +
          "현재 잔액은 {__amount__} 위안입니다.",
        pt:
          "A conta {__accountName__} foi recarregada com {__chargeAmount__} yuan em [{__time__}]. " +
          "O saldo atual é {__amount__} yuan.",
        ru:
          "Счёт {__accountName__} пополнен на {__chargeAmount__} юаней в [{__time__}]. " +
          "Текущий баланс: {__amount__} юаней.",
        zhCn: "账户 {__accountName__} 已于【{__time__}】成功充值 {__chargeAmount__} 元，当前余额为 {__amount__} 元。",
      },
    },
  ],
  [
    InternalMessageType.AccountLowBalance,
    {
      type: "AccountLowBalance",
      titleTemplate: {
        default: "余额不足提醒",
        en: "Account Low Balance",
        de: "Niedriger Kontostand",
        es: "Saldo de cuenta bajo",
        fr: "Solde du compte faible",
        ja: "口座残高が少ない",
        ko: "계정 잔액 부족",
        pt: "Saldo da conta baixo",
        ru: "Низкий баланс счёта",
        zhCn: "余额不足提醒",
      },
      category: "Account",
      categoryTemplate: {
        default: "账户消息",
        en: "Account Messages",
        de: "Kontonachrichten",
        es: "Mensajes de cuenta",
        fr: "Messages du compte",
        ja: "アカウントメッセージ",
        ko: "계정 메시지",
        pt: "Mensagens da conta",
        ru: "Сообщения счёта",
        zhCn: "账户消息",
      },
      contentTemplate: {
        default: "截至【{__time__}】，账户 {__accountName__} 余额已不足 20 元，请及时交费。",
        en: "As of [{__time__}], the balance of account {__accountName__} is less than 20 yuan. Please pay in time.",
        de:
          "Zum Zeitpunkt [{__time__}] beträgt der Kontostand von {__accountName__} weniger als 20 Yuan. " +
          "Bitte zahlen Sie rechtzeitig.",
        es:
          "A [{__time__}], el saldo de la cuenta {__accountName__} es inferior a 20 yuanes. " +
          "Por favor pague a tiempo.",
        fr:
          "À [{__time__}], le solde du compte {__accountName__} est inférieur à 20 yuan. " +
          "Veuillez payer rapidement.",
        ja:
          "[{__time__}] 時点で、アカウント {__accountName__} の残高は 20 元未満です。" + " 速やかにお支払いください。",
        ko: "[{__time__}] 기준, 계정 {__accountName__} 의 잔액은 20 위안 미만입니다. " + "빠른 납부를 부탁드립니다.",
        pt: "Em [{__time__}], o saldo da conta {__accountName__} é inferior a 20 yuan. " + "Por favor, pague em tempo.",
        ru: "На [{__time__}] баланс счёта {__accountName__} менее 20 юаней. " + "Пожалуйста, оплатите вовремя.",
        zhCn: "截至【{__time__}】，账户 {__accountName__} 余额已不足 20 元，请及时交费。",
      },
    },
  ],
  [
    InternalMessageType.AccountBalance,
    {
      type: "AccountBalance",
      titleTemplate: {
        default: "余额变动通知",
        en: "Account Balance",
        de: "Kontosaldoänderung",
        es: "Cambio de saldo de cuenta",
        fr: "Variation du solde du compte",
        ja: "口座残高の変動",
        ko: "계정 잔액 변동",
        pt: "Alteração de saldo da conta",
        ru: "Изменение баланса счёта",
        zhCn: "余额变动通知",
      },
      category: "Account",
      categoryTemplate: {
        default: "账户消息",
        en: "Account Messages",
        de: "Kontonachrichten",
        es: "Mensajes de cuenta",
        fr: "Messages du compte",
        ja: "アカウントメッセージ",
        ko: "계정 메시지",
        pt: "Mensagens da conta",
        ru: "Сообщения счёта",
        zhCn: "账户消息",
      },
      contentTemplate: {
        default: "账户 {__accountName__} 余额发生变动，支出 {__amount__} 元，当前余额为 {__balance__}。",
        en: "Balance change in account {__accountName__}: expenditure of {__amount__}, current balance is {__balance__}.",
        de: "Kontosaldoänderung für {__accountName__}: Ausgabe {__amount__}, aktueller Saldo {__balance__}.",
        es: "Cambio de saldo en la cuenta {__accountName__}: gasto de {__amount__}, saldo actual {__balance__}.",
        fr:
          "Changement de solde du compte {__accountName__} : dépense de {__amount__}, " +
          "solde actuel de {__balance__}.",
        ja: "アカウント {__accountName__} の残高が変動しました。支出 {__amount__}、現在の残高 {__balance__}。",
        ko: "계정 {__accountName__} 잔액 변동: 지출 {__amount__}, 현재 잔액 {__balance__}.",
        pt: "Alteração de saldo na conta {__accountName__}: despesa de {__amount__}, saldo atual {__balance__}.",
        ru: "Изменение баланса счёта {__accountName__}: расход {__amount__}, текущий баланс {__balance__}.",
        zhCn: "账户 {__accountName__} 余额发生变动，支出 {__amount__} 元，当前余额为 {__balance__}。",
      },
    },
  ],
  [
    InternalMessageType.AccountLocked,
    {
      type: "AccountLocked",
      titleTemplate: {
        default: "账户封锁通知",
        en: "Account Locked",
        de: "Konto gesperrt",
        es: "Cuenta bloqueada",
        fr: "Compte bloqué",
        ja: "アカウントがロックされました",
        ko: "계정 잠금",
        pt: "Conta bloqueada",
        ru: "Счёт заблокирован",
        zhCn: "账户封锁通知",
      },
      category: "Account",
      categoryTemplate: {
        default: "账户消息",
        en: "Account Messages",
        de: "Kontonachrichten",
        es: "Mensajes de cuenta",
        fr: "Messages du compte",
        ja: "アカウントメッセージ",
        ko: "계정 메시지",
        pt: "Mensagens da conta",
        ru: "Сообщения счёта",
        zhCn: "账户消息",
      },
      contentTemplate: {
        default: "账户 {__accountName__} 已于【{__time__}】被封锁，您可以联系管理员申请解封。",
        en:
          "The account {__accountName__} has been blocked at [{__time__}]. " +
          "You can contact the administrator to request unblocking.",
        de:
          "Das Konto {__accountName__} wurde am [{__time__}] gesperrt. " +
          "Bitte kontaktieren Sie den Administrator zur Entsperrung.",
        es:
          "La cuenta {__accountName__} fue bloqueada el [{__time__}]. " +
          "Puede contactar al administrador para solicitar el desbloqueo.",
        fr:
          "Le compte {__accountName__} a été bloqué le [{__time__}]. " +
          "Vous pouvez contacter l’administrateur pour demander le déblocage.",
        ja:
          "アカウント {__accountName__} は [{__time__}] にロックされました。" + " 管理者に連絡して解除を依頼できます。",
        ko: "계정 {__accountName__} 는 [{__time__}] 에 잠금되었습니다. " + "관리자에게 문의하여 해제를 요청하세요.",
        pt:
          "A conta {__accountName__} foi bloqueada em [{__time__}]. " +
          "Você pode contatar o administrador para solicitar o desbloqueio.",
        ru:
          "Счёт {__accountName__} был заблокирован в [{__time__}]. " + "Свяжитесь с администратором для разблокировки.",
        zhCn: "账户 {__accountName__} 已于【{__time__}】被封锁，您可以联系管理员申请解封。",
      },
    },
  ],
  [
    InternalMessageType.AccountUnblocked,
    {
      type: "AccountUnblocked",
      titleTemplate: {
        default: "账户解封通知",
        en: "Account Unblocking",
        de: "Konto entsperrt",
        es: "Cuenta desbloqueada",
        fr: "Compte débloqué",
        ja: "アカウントのロック解除",
        ko: "계정 해제",
        pt: "Conta desbloqueada",
        ru: "Счёт разблокирован",
        zhCn: "账户解封通知",
      },
      category: "Account",
      categoryTemplate: {
        default: "账户消息",
        en: "Account Messages",
        de: "Kontonachrichten",
        es: "Mensajes de cuenta",
        fr: "Messages du compte",
        ja: "アカウントメッセージ",
        ko: "계정 메시지",
        pt: "Mensagens da conta",
        ru: "Сообщения счёта",
        zhCn: "账户消息",
      },
      contentTemplate: {
        default: "账户 {__accountName__} 已于【{__time__}】恢复正常。",
        en: "Account {__accountName__} has been restored to normal at [{__time__}].",
        de: "Das Konto {__accountName__} wurde am [{__time__}] wiederhergestellt.",
        es: "La cuenta {__accountName__} fue restablecida el [{__time__}].",
        fr: "Le compte {__accountName__} a été rétabli le [{__time__}].",
        ja: "アカウント {__accountName__} は [{__time__}] に通常状態へ復帰しました。",
        ko: "계정 {__accountName__} 는 [{__time__}] 에 정상으로 복구되었습니다.",
        pt: "A conta {__accountName__} foi restaurada em [{__time__}].",
        ru: "Счёт {__accountName__} восстановлен [{__time__}].",
        zhCn: "账户 {__accountName__} 已于【{__time__}】恢复正常。",
      },
    },
  ],

  // Job
  // [InternalMessageType.JobStarted, {
  //   type: "JobStarted",
  //   titleTemplate: {
  //     default: "作业开始",
  //     en: "Job Started",
  //     zhCn: "作业开始",
  //   },
  //   category: "Job",
  //   categoryTemplate: {
  //     default: "作业消息",
  //     en: "Job Messages",
  //     zhCn: "作业消息",
  //   },
  //   contentTemplate: {
  //     default: "",
  //   },
  // }],
  [
    InternalMessageType.JobFinished,
    {
      type: "JobFinished",
      titleTemplate: {
        default: "作业完成",
        en: "Job Finished",
        de: "Job abgeschlossen",
        es: "Trabajo finalizado",
        fr: "Tâche terminée",
        ja: "ジョブ完了",
        ko: "작업 완료",
        pt: "Trabalho concluído",
        ru: "Задача завершена",
        zhCn: "作业完成",
      },
      category: "Job",
      categoryTemplate: {
        default: "作业消息",
        en: "Job Messages",
        de: "Job‑Nachrichten",
        es: "Mensajes de trabajo",
        fr: "Messages de tâche",
        ja: "ジョブメッセージ",
        ko: "작업 메시지",
        pt: "Mensagens de trabalho",
        ru: "Сообщения о заданиях",
        zhCn: "作业消息",
      },
      contentTemplate: {
        default: "作业【{__jobId__}】已于【{__time__}】运行结束。",
        en: "Job [{__jobId__}] completed at [{__time__}].",
        de: "Job [{__jobId__}] wurde am [{__time__}] abgeschlossen.",
        es: "El trabajo [{__jobId__}] finalizó el [{__time__}].",
        fr: "Tâche [{__jobId__}] terminée le [{__time__}].",
        ja: "ジョブ [{__jobId__}] は [{__time__}] に完了しました。",
        ko: "작업 [{__jobId__}] 이 [{__time__}] 에 완료되었습니다.",
        pt: "O trabalho [{__jobId__}] foi concluído em [{__time__}].",
        ru: "Задача [{__jobId__}] завершена в [{__time__}].",
        zhCn: "作业【{__jobId__}】已于【{__time__}】运行结束。",
      },
    },
  ],
  // [InternalMessageType.JobAbnormalTermination, {
  //   type: "JobAbnormalTermination",
  //   titleTemplate: {
  //     default: "作业异常终止",
  //     en: "Job Abnormal Termination",
  //     zhCn: "作业异常终止",
  //   },
  //   category: "Job",
  //   categoryTemplate: {
  //     default: "作业消息",
  //     en: "Job Messages",
  //     zhCn: "作业消息",
  //   },
  //   contentTemplate: {
  //     default: "",
  //   },
  // }],
  [
    InternalMessageType.AccountUserSyncResult,
    {
      type: "AccountUserSyncResult",
      titleTemplate: {
        default: "账户/用户信息同步通知",
        en: "Account/User Information Synchronization Notification",
        zhCn: "账户/用户信息同步通知",
      },
      // 系统消息
      category: "Admin",
      categoryTemplate: {
        default: "系统消息",
        en: "System Messages",
        zhCn: "系统消息",
      },
      contentTemplate: {
        default:
          "{__time__}，{__syncI18nClusterNames__}同步【{__messageStatus__}】。" +
          "共成功 {__totalSucceedCount__} 条，失败 {__totalFailedCount__} 条。",
        en:
          "Account User Synchronization completed at {__time__}. The synchronization status " +
          "of {__syncI18nClusterNames__} is【{__messageStatus__}】. " +
          "Successfully processed {__totalSucceedCount__} records, failed {__totalFailedCount__} records.",
        zhCn:
          "{__time__}，{__syncI18nClusterNames__}同步【{__messageStatus__}】。" +
          "共成功 {__totalSucceedCount__} 条，失败 {__totalFailedCount__} 条。",
      },
    },
  ],
  // 监控告警消息，title/content 由 Alertmanager 通过 webhook 传入，元数据中含双语字段
  [
    InternalMessageType.MonitorAlert,
    {
      type: "MonitorAlert",
      titleTemplate: {
        default: "监控告警",
        en: "Monitor Alert",
        zhCn: "监控告警",
      },
      category: "Admin",
      categoryTemplate: {
        default: "系统消息",
        en: "System Messages",
        zhCn: "系统消息",
      },
      contentTemplate: {
        default: "{__contentZhCn__}",
        en: "{__contentEn__}",
        zhCn: "{__contentZhCn__}",
      },
    },
  ],
  // 其他默认数据...
]);
