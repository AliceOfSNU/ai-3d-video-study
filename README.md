# AI로 나만의 3D 영상을 만들어봐요 · 스터디 자료

코워크크루(coworkcrew.ai.kr) 가이드 스터디 "AI로 나만의 3D 영상을 만들어봐요"의 학습 페이지와 기획 문서입니다. 코워크크루 웹페이지에 옮겨 넣기 쉽도록 내용, 화면, 생성 API를 나눠 두었습니다.

## 지금 상태

| 범위 | 상태 |
|---|---|
| Lv.1 유닛 1-1 "AI 이미지 모델 써보기" (6스텝) | 페이지 완성 |
| Lv.1 유닛 1-2 "AI 이미지 모델 비교하기" (7스텝) | 페이지 완성, 예시 비교 12장 포함. 힉스필드 장당 크레딧 값만 비어 있음 (`content/lv1.js`의 `HF_CREDITS`) |
| Lv.1 유닛 1-3 ~ 1-7 | 목록에만 "준비 중"으로 표시 |
| Lv.2 ~ Lv.8 | 전체 개요만 ([common/plan.md](common/plan.md)) |

## 폴더

| 경로 | 내용 |
|---|---|
| [site/](site/) | 학습 페이지 (HTML + 바닐라 JS 모듈, 빌드 없음) 와 개발용 서버 `server.py` |
| [site/README.md](site/README.md) | **이식 안내**: 파일 구조, 블록 종류, 생성 API 계약 |
| [lv1/readme.md](lv1/readme.md) | Lv.1 학습 목표와 유닛별 기획 (유닛 1-2 기획 포함) |
| [common/plan.md](common/plan.md) | 8단계 전체 개요 |

## 띄워 보기

Python 3.10 이상이면 됩니다. 설치할 패키지는 없습니다.

```
cd site
STUDY_IMAGE_PROVIDER=mock python server.py     # http://localhost:8010/  자리표시 이미지, 비용 0
```

실제 이미지를 만들려면 이 폴더(저장소 루트)에 `.env`를 두고 `OPENAI_API_KEY=...`(GPT Image 2.6), `GEMINI_API_KEY=...`(Nano Banana 2.1), `ARK_API_KEY=...`(Seedream 5.5)를 넣습니다. `.env`는 `.gitignore`에 들어 있어 커밋되지 않습니다. 주소 뒤에 `?preview=1`을 붙이면 저장하지 않는 운영진 미리보기가 됩니다.

## 코워크크루에 옮길 때 할 일

1. **내용** `site/content/lv1.js`: 레벨 → 유닛 → 스텝 → 블록 데이터입니다. 그대로 옮기거나 JSON으로 바꿔 씁니다.
2. **화면** `site/js/app.js`, `site/css/study.css`: 블록 종류별 렌더러입니다. 코워크크루 프레임워크 컴포넌트로 옮깁니다.
3. **저장** `site/js/store.js`: 지금은 브라우저(localStorage, IndexedDB)에 저장합니다. 참가자 계정별 저장소로 바꿉니다.
4. **이미지 생성 API**: `server.py`는 개발용입니다. 코워크크루 키로 [site/README.md의 API 계약](site/README.md#생성-api-계약-코워크크루가-구현할-부분)대로 다시 구현합니다.
   - 요청을 받으면 작업 번호를 바로 돌려주고, 페이지가 결과를 따로 묻는 방식입니다. 폰에서 생성이 끊기지 않게 하려는 것입니다.
   - 모델 연결 현황:

| 모델 (페이지 ID) | 연결 | 비고 |
|---|---|---|
| GPT Image 2.6 (`gpt_image_2_6`) | OpenAI `gpt-image-2.6-sunburst` | 개발 서버에서 실제로 생성됨 |
| Nano Banana 2.1 (`nano_banana_2_1`) | Gemini `gemini-nano-banana-2.1` | 결제가 켜진 Gemini 키가 필요함. 무료 등급 키는 이미지 할당량이 없음 |
| Seedream 5.5 (`seedream_5_5`) | BytePlus ModelArk `dola-seedream-5-5-261028` | Ark 콘솔에서 모델 활성화 필요. 장당 $0.020. 힉스필드 공개 API에는 없음 |

   키가 없는 모델은 개발 서버가 GPT Image 2.6로 대신 만들고 "개발용 대체" 표시를 붙입니다.
