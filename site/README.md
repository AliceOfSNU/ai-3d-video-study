# 스터디 페이지 (로컬 작업본)

코워크크루 레포를 받기 전까지 로컬에서 보면서 만드는 작업본입니다. 이식할 때 바꾸기 쉽도록 내용, 화면, 생성 API를 분리했습니다.

## 띄우기

```
python server.py            # http://localhost:8010/          실제 생성
                            #   GPT Image 2.6   = OpenAI gpt-image-2.6-sunburst (OPENAI_API_KEY)
                            #   Nano Banana 2.1 = Gemini gemini-nano-banana-2.1 (GEMINI_API_KEY, 결제가 켜진 프로젝트여야 함)
                            #   Seedream 5.5    = BytePlus ModelArk dola-seedream-5-5-261028 (ARK_API_KEY, Ark 콘솔에서 모델 활성화 필요)
STUDY_IMAGE_PROVIDER=mock python server.py 8011               # 비용 0 목업 생성
```

- 운영진 미리보기: 주소 뒤에 `?preview=1`을 붙입니다(예: `http://localhost:8010/?preview=1`). 미리보기에서는 적은 내용, 체크, 이미지가 저장되지 않습니다.
- 키(`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ARK_API_KEY`)는 `STUDY_ENV_FILE`이 가리키는 파일에서 읽습니다. 지정하지 않으면 저장소 루트의 `.env`를 읽습니다. 키는 브라우저로 보내지 않습니다.
- Gemini나 ModelArk가 계정 문제로 거절하면 그 모델 요청은 GPT Image 2.6으로 대신 만들고 "개발용 대체" 표시를 붙입니다. 계정 문제란 할당량 없음, 결제 꺼짐, 모델 미활성화(ModelNotOpen) 같은 경우입니다. 10분 동안은 그 제공자를 다시 부르지 않습니다.

## 구조

| 파일 | 역할 | 이식할 때 |
|---|---|---|
| `content/lv1.js` | 레벨 → 유닛 → 스텝 → 블록 데이터 (글, 예시 프롬프트, 체크리스트) | 그대로 옮긴다 (JSON으로 바꿔도 됨) |
| `js/app.js` | 데이터를 화면으로 그리는 렌더러 (헤더, 유닛 목록, 스텝 탭, 블록) | 코워크크루 프레임워크 컴포넌트로 옮긴다 |
| `js/store.js` | 참가자 상태 저장. 글·체크·완료는 localStorage, 이미지는 IndexedDB | 코워크크루 저장소(계정별)로 바꾼다 |
| `css/study.css` | 화면 스타일 (캡처 예시 UI에 맞춤) | 디자인 시스템에 맞춰 옮긴다 |
| `server.py` | 정적 파일 + 이미지 생성 API (개발용) | API만 코워크크루 키로 다시 구현한다 |

## 블록 종류 (`content/*.js`)

| type | 용도 |
|---|---|
| `lead` | 큰 소개 문단 |
| `make` | "이 유닛이 끝나면 갖게 되는 것" 카드 |
| `flow` | 진행 순서 칩 |
| `guide` | 제목 + 안내 목록 (굵게 등 HTML 허용) |
| `anatomy` | 프롬프트 뼈대: 색깔 구간 + "합치면" 문장 |
| `tip` | 초록 강조 팁 |
| `generator` | 예시 프롬프트 칩 → 편집 → 모델 3개 중 선택 → 화면 비율 → 생성 → 결과 목록. `ref`가 있으면 앞 스텝 이미지를 참고 이미지로 자동 연결한다. `pairFrom`이 있으면 앞 스텝에서 고른 예시의 `pair`와 같은 `key`의 예시를 "내 인물과 어울려요"로 추천하고 미리 채운다 |
| `ab` | 같은 참고 이미지 + 기본 문장 + A/B 한 줄씩(프리셋 칩)으로 두 장을 동시에 생성해 나란히 비교 |
| `check` | 마무리 체크리스트 |
| `pick` | 결과물 고르기 (이미지함에서 고르기, 직접 올리기, 내려받기) |
| `table` | 정적인 표 (`head`, `rows`, `note`) |
| `compare` | 프롬프트 하나로 세 모델을 동시에 생성해 이름을 가린 A·B·C로 보여 준다. 한 장을 고르고 이유 칩을 누르면 이름이 공개된다. 고른 결과는 `lv1:<유닛>:pick:<id>`에 저장. `promptFrom`(앞 유닛 프롬프트), `pairFrom`(짝 추천), `ref`(`prefer`: 앞 유닛에서 고른 이미지, `sample`: 건너뛴 사람용 예시), `showRef`(원본 같이 보기), `toggleRef`(원본과 번갈아 보기), `aspect: "ref"`(원본 비율) |
| `compare`의 `example` | 운영진이 미리 만든 세 모델 결과(`site/assets/examples/`), 접힌 채로 이름과 생성 시간을 보여 준다 |
| `stats` | 모델별 평균 생성 시간, 고른 횟수, 힉스필드 크레딧(`credits`, 비어 있으면 "확인 예정") |
| `summary` | `compare` 결과로 채워지는 선택표, 기본 모델 고르기(이후 생성기의 기본값), 표를 PNG로 내려받기 |

이미지에는 `tag`(person / place / style / mood / cmp / upload)가 붙습니다. 뒤 스텝은 이 태그로 앞 스텝의 결과를 찾습니다.

## 생성 API 계약 (코워크크루가 구현할 부분)

```
GET  /api/config
  -> {"mode": "live" | "dev-openai" | "mock", "label": "..."}      # "live"면 개발 배너를 띄우지 않는다

POST /api/images/generate
  {"model": "seedream_5_5" | "gpt_image_2_6" | "nano_banana_2_1",
   "prompt": "...", "aspect_ratio": "2:3" | "3:4" | "1:1" | "16:9" | "9:16" | "3:2",
   "references": ["data:image/png;base64,...", ...]}             # 참고 이미지 (스텝 3~5)
  -> 202 {"job": "<id>", "status": "running"}                     # 바로 돌아온다
  요청이 잘못됐거나 한도 초과 -> HTTP 4xx + {"error": "참가자에게 보여줄 한국어 메시지"}

GET  /api/images/jobs/<id>                                         # 페이지가 2초마다 묻는다
  -> {"status": "running"}
   | {"status": "done", "image": "data:image/...;base64,..." 또는 URL, "model": "...", "provider": "...", "note": "...", "ms": 23000}
   | {"status": "error", "error": "참가자에게 보여줄 한국어 메시지"}
```

생성은 15~90초 걸립니다. 요청 하나를 그동안 열어 두면 폰에서 실패합니다. 사파리는 탭이 뒤로 가면 연결을 끊어 "Load failed"가 뜨고, 이미 만든 이미지는 버려집니다. 그래서 작업 번호를 받고 결과를 따로 묻는 방식으로 바꿨습니다. 결과를 묻는 요청이 한 번 실패해도 다음 요청에서 다시 받습니다. 끝난 작업은 30분 동안 보관합니다.

`/api/images/generate`가 바로 `{"image": ...}`를 돌려줘도 페이지는 그대로 받습니다. 다만 위 이유로 작업 방식을 권합니다.

모델 ID는 Higgsfield와 같습니다. 셋 다 참고 이미지(`image_references`)를 받습니다. 다만 Higgsfield 공개 REST API(`GET api.higgsfield.ai/models`, 96개, 2026-11-14 확인)에는 이 세 이미지 모델이 없어서, 실제 연결은 코워크크루가 쓰는 제공자에 맞춰야 합니다. Seedream은 바이트댄스 BytePlus ModelArk로 연결합니다. 장당 $0.020이고 260만 화소 이하 기준이며, 참고 이미지는 장당 $0.008입니다. 서버는 비율마다 약 157만 화소로 요청합니다.
