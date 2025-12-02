/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

export default {
  login: {
    login: "登录",
    accountPasswordLogin: "账号密码登录",
    userId: "用户ID",
    password: "密码",
    otpVCode: "OTP验证码",
    inputVCode: "请输入验证码",
    refreshError: "刷新失败，请点击重试",
    invalidVCode: "验证码无效，请重新输入。",
    invalidInput: "用户名/密码无效，请检查",
    accountLocked: "账户已被锁定，请联系管理员",
    accountLockedTime1: "账户已被锁定",
    accountLockedTime2: "分钟，请稍后再试",
    invalidUserId: "无效用户ID, 请检查。",
    invalidPasswordRemain: "密码无效，剩余可输入次数：",
    invalidPassword: "密码无效，请重新输入",
    invalidOtp: "OTP验证码无效，请重新输入。",
    bindOtp: "绑定otp",
    platformSystem : "算力平台系统",
  },
  bindOtp: {
    bindOtp: "绑定OTP",
    returnLogin: "返回登录",
    userName: "用户名",
    password: "密码",
    invalidUserNamePassword: "用户名/密码无效，请检查。",
    confirm: "确认",
    expiredUserInfo: "用户信息过期，请重新绑定!",
    bindLimit1: "请于",
    bindLimit2: "分钟内完成绑定",
    email: "您的邮箱",
    getBindLink: "获取绑定链接",
    bindLinkSended: "绑定链接已发送，请在邮箱内进行验证",
    bindLinkFailed1: "绑定链接发送失败，请在",
    bindLinkFailed2: "秒后重新获取",
    bindRequestError1: "请勿频繁获取绑定链接，请在",
    bindRequestError2: "秒后重新获取",
    reRequestLink: "现在您可以重新获取链接",
  },
  changePassword: {
    title: "修改密码",
    userid: "用户id",
    newPassword: "新密码",
    confirmPassword: "确认密码",
    cancel: "取消",
    confirm: "确定",
    modificationFailed: "修改失败",
    modificationSuccessed: "修改成功，即将登录系统",
    passwordInconsistent: "新密码与确认密码不一致",
    allFieldsAreMandatory: "所有字段均为必填项",
    passwordRuleVerification: "密码必须包含字母、数字和符号，长度大于等于8位",
    invalidUserNamePassword: "用户名/密码无效，请检查。",
    submitting: "提交中...",
    forcePasswordChange: "该账号为首次登录或被系统重置了密码，请先修改初始密码再使用",
  },
};
