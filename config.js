/**
 * config.js
 * 학교/담당 교사가 배포 전에 값만 바꾸는 설정 파일입니다.
 * 코드 구조를 몰라도 이 파일만 열어 값을 바꾸면 됩니다.
 */
window.APP_CONFIG = {
  // 면접 후기를 학교(구글 폼 등)로도 제출받고 싶다면 URL을 넣으세요.
  // 비워 두면 "면접 후기 학교에 제출하기" 버튼이 화면에 나타나지 않습니다.
  // 예: "https://docs.google.com/forms/d/e/xxxxxxxx/viewform"
  AFTER_INTERVIEW_FORM_URL: "",

  // 학교/프로그램 이름 (화면 하단 표시용, 비워도 됩니다)
  SCHOOL_LABEL: "",

  // 앱 표시 이름
  APP_NAME: "2027 대입 면접 준비 허브",

  // 배포 버전
  APP_VERSION: "4.0-simple",
};
