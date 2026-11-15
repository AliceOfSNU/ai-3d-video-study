// Lv.1 study content. Pure data: the renderer in js/app.js turns each block `type` into UI.
// Block types: lead, make, flow, guide, anatomy, tip, generator, ab, check, pick (see README.md).

// Person and place examples come in pairs (`pair` = place `key`): each person belongs naturally in one of the
// four places, and step 3 recommends the place that matches the person picked in step 2.
const PERSON_EXAMPLES = [
  {
    label: "20대 · 울코트",
    pair: "street",
    pairLabel: "길거리",
    prompt: "20대 초반 한국 여성. 검은 단발머리에 가벼운 앞머리. 카멜색 울 롱코트, 크림색 터틀넥 니트, 빨간 체크 머플러, 연청 바지, 흰 운동화, 어깨에 작은 갈색 가방. 카메라를 보며 살짝 웃는 표정. 머리부터 발끝까지 보이는 전신, 정면에 가까운 자세. 밝은 회색 무지 배경. 부드러운 자연광, 실사 사진.",
  },
  {
    label: "20대 · 숲속 여행자",
    pair: "forest",
    pairLabel: "숲",
    prompt: "20대 후반 한국 남성 여행자. 덥수룩한 검은 머리와 짧은 수염. 모자가 달린 카키색 두꺼운 패딩 파카, 회색 털모자, 두툼한 니트 목도리와 털장갑, 낡은 갈색 가죽 방한 부츠. 등에 큰 배낭을 메고 한 손에 작은 랜턴을 들었다. 호기심 어린 표정. 머리부터 발끝까지 보이는 전신, 정면. 연한 회색 무지 배경. 부드러운 조명, 실사 사진.",
  },
  {
    label: "20대 · K-pop 아이돌",
    pair: "kpop",
    pairLabel: "K-pop 세트",
    prompt: "20대 초반 한국 여성, K-pop 아이돌 스타일. 은색으로 염색한 긴 생머리. 반짝이는 은색 숏패딩, 검은 와이드 팬츠, 굵은 체인 목걸이, 두꺼운 밑창의 흰 퍼 부츠. 자신감 있는 눈빛으로 카메라를 본다. 머리부터 발끝까지 보이는 전신, 정면. 검은색 무지 배경. 깔끔한 스튜디오 조명, 실사 사진.",
  },
  {
    label: "30대 · 회사원",
    pair: "office",
    pairLabel: "오피스",
    prompt: "30대 한국 남성 회사원. 단정하게 넘긴 짧은 머리. 회색 터틀넥 니트에 차콜 슬랙스, 팔에 걸친 남색 울 코트, 목에 건 사원증, 한 손에 텀블러. 조금 피곤하지만 친근한 미소. 머리부터 발끝까지 보이는 전신, 정면. 밝은 회색 무지 배경. 부드러운 사무실 조명, 실사 사진.",
  },
];

const PLACE_EXAMPLES = [
  {
    key: "street",
    label: "한국의 길거리",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 한겨울 오후, 서울의 좁은 상점가 골목에서 횡단보도를 건너는 장면. 양옆에 한글 간판이 달린 가게들, 머리 위로 얽힌 전깃줄, 길가와 지붕에 조금 남은 눈. 차가운 공기에 입김이 하얗게 보인다. 인물은 화면 가운데 전신, 눈높이 카메라. 실사 사진.",
  },
  {
    key: "forest",
    label: "신비로운 숲",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 눈 덮인 깊은 겨울 숲, 하얀 눈이 쌓인 거대한 침엽수 사이 오솔길을 걸으며 위를 올려다보는 장면. 가지 사이로 차가운 빛줄기가 내려오고 공기 중에 눈가루가 반짝인다. 전신, 조금 낮은 곳에서 올려다보는 카메라. 실사 사진.",
  },
  {
    key: "kpop",
    label: "K-pop 뮤비 세트 · 다락방",
    // our own set photo (made 2026-11-14, no people), attached as a second (location) reference
    placeRef: { src: "assets/places/kpop_attic.jpg", label: "미리 만들어 둔 세트 사진 · 이 방에 내 인물을 넣어요" },
    prompt: "첫 번째 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 두 번째 이미지는 장소 참고다: 이 다락방의 경사진 천장, 벽, 러그, 빈백, TV, 꼬마전구, 둥근 창을 그대로 쓴다. 창밖으로 눈이 내리는 겨울 오후, 꼬마전구가 따뜻하게 켜져 있다. 인물이 러그 위에서 안무 동작의 한 순간처럼 포즈를 잡는다. 전신, 정면 와이드. 실사 사진.",
  },
  {
    key: "office",
    label: "오피스 자리",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 창가 사무실 책상에 앉아 노트북을 보다가 고개를 든 순간. 창밖으로 눈이 내리는 겨울 오후. 책상 위에 모니터, 서류 더미, 김이 오르는 머그컵. 뒤로 다른 책상들이 흐릿하게 보인다. 허리 위가 보이는 미디엄 샷. 실사 사진.",
  },
];

const SAME_SCENE = "첨부한 이미지와 같은 장면이다. 인물의 얼굴·머리·옷, 장소, 구도는 그대로 둔다.";

// ---- unit 1-2 (model comparison) ------------------------------------------------------------------------
const KEEP_PERSON = "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다).";

// step 3: same person, different shot. Plain background so only the person is compared.
const SHOT_EXAMPLES = [
  { label: "얼굴 클로즈업", aspect: "3:4",
    prompt: `${KEEP_PERSON} 같은 인물의 얼굴 클로즈업. 어깨 위까지, 정면에서 살짝 옆을 본다. 밝은 회색 무지 배경, 부드러운 자연광. 실사 사진.` },
  { label: "옆모습 전신", aspect: "2:3",
    prompt: `${KEEP_PERSON} 같은 인물이 오른쪽으로 걸어가는 옆모습 전신. 밝은 회색 무지 배경. 실사 사진.` },
  { label: "웃는 미디엄 샷", aspect: "3:4",
    prompt: `${KEEP_PERSON} 같은 인물이 소리 내어 웃는 순간, 허리 위 미디엄 샷. 밝은 회색 무지 배경. 실사 사진.` },
];

// step 4: the unit 1 place again, without people, with one short Korean text. `key` matches the person's pair.
const TEXT_EXAMPLES = [
  { key: "street", label: "길거리 · 간판", pairLabel: "'청춘분식'",
    prompt: "한겨울 서울의 좁은 상점가 골목, 사람 없음. 가운데 분식집 간판에 '청춘분식'이라는 한글이 크게 적혀 있다. 양옆에 작은 가게들, 머리 위 전깃줄, 길가와 지붕에 조금 남은 눈. 맑고 차가운 오후 빛, 눈높이 카메라. 실사 사진." },
  { key: "forest", label: "숲 · 표지판", pairLabel: "'눈꽃숲 1km'",
    prompt: "눈 덮인 깊은 겨울 숲속 오솔길, 사람 없음. 길가의 낡은 나무 표지판에 '눈꽃숲 1km'라는 한글이 새겨져 있고 표지판 위에 눈이 소복이 쌓였다. 눈 쌓인 거대한 침엽수들, 가지 사이로 내려오는 차가운 빛줄기. 실사 사진." },
  { key: "kpop", label: "뮤비 세트 · TV", pairLabel: "'게임 시작'",
    prompt: "K-pop 뮤직비디오 세트로 꾸민 작은 다락방, 사람 없음. 경사진 흰 나무 천장, 따뜻한 크림색 벽, 연보라 러그와 빈백. 낮은 원목 테이블 위 작은 브라운관 TV 화면에 '게임 시작'이라는 한글이 픽셀 글씨로 떠 있다. 벽에는 폴라로이드 사진과 꼬마전구만 있다. 둥근 창밖으로 눈이 내린다. 정면 와이드. 실사 사진." },
  { key: "office", label: "오피스 · 포스트잇", pairLabel: "'3시 회의'",
    prompt: "창가 사무실 책상, 사람 없음. 모니터 가장자리에 붙은 노란 포스트잇에 '3시 회의'라고 손글씨로 적혀 있다. 노트북, 서류 더미, 김이 오르는 머그컵, 창밖으로 내리는 눈, 뒤로 흐릿한 다른 책상들. 실사 사진." },
];

// step 5: change exactly one thing in the unit 1 place shot
const EDIT_BASE = "첨부한 이미지와 같은 장면이다. 아래 한 가지만 바꾸고 나머지(얼굴, 머리, 옷, 배경, 구도)는 그대로 둔다.";
const EDIT_EXAMPLES = [
  { label: "겉옷 색만", prompt: `${EDIT_BASE}\n겉옷 색만 짙은 남색으로 바꾼다.` },
  { label: "커피 컵 하나", prompt: `${EDIT_BASE}\n인물 손에 테이크아웃 커피 컵 하나만 들게 한다.` },
  { label: "해 질 녘으로", prompt: `${EDIT_BASE}\n시간만 해 질 녘으로 바꿔 주황빛이 들게 한다.` },
];

// step 6: Higgsfield credits per image. The Higgsfield API does not expose prices: fill these in from the
// Higgsfield image generator screen (null shows "확인 예정") and set CREDITS_CHECKED to the date.
const HF_CREDITS = { seedream_5_5: 3.5, gpt_image_2_6: 0.25, nano_banana_2_1: 1.5 };
const CREDITS_CHECKED = "2026-11-14";
const CREDITS_NOTE = "설정은 힉스필드 기본값(Seedream 2K, GPT Image 1K·low, Nano Banana 1K)이에요. Seedream을 1K로 내리면 2.5, GPT Image를 medium 품질로 올리면 0.5크레딧이에요.";

// pre-made comparisons (one per compare step), made 2026-11-14 with the three real models from the first example
// of each step (wool-coat person / street pair; the study runs in December, so winter clothes). Seconds as measured.
const exampleSet = (id, label, ref, seconds) => ({
  label, ref, seconds,
  images: Object.fromEntries(["seedream_5_5", "gpt_image_2_6", "nano_banana_2_1"].map((m) => [m, `assets/examples/${id}_${m}.jpg`])),
});
const EXAMPLE_REAL = exampleSet("real", "울코트 인물 프롬프트", null, { seedream_5_5: 13, gpt_image_2_6: 21, nano_banana_2_1: 16 });
const EXAMPLE_IDENTITY = exampleSet("identity", "얼굴 클로즈업", "assets/sample_person.jpg", { seedream_5_5: 16, gpt_image_2_6: 19, nano_banana_2_1: 13 });
const EXAMPLE_HANGUL = exampleSet("hangul", "겨울 길거리 · '청춘분식' 간판", null, { seedream_5_5: 19, gpt_image_2_6: 29, nano_banana_2_1: 16 });
const EXAMPLE_EDIT = exampleSet("edit", "겉옷 색만 남색으로", "assets/sample_place.jpg", { seedream_5_5: 22, gpt_image_2_6: 25, nano_banana_2_1: 13 });

// unit 1 results that unit 2 builds on (store keys written by unit 1 blocks)
const U1_PERSON_PROMPT = "lv1:u1:gen:person:prompt";
const U1_PICK_PERSON = "lv1:u1:pick:unit1pick:person";
const U1_PICK_PLACE = "lv1:u1:pick:unit1pick:place";

// ---- unit 1-3 (first video on Higgsfield, Wan 3.0) -------------------------------------------------------
// Videos are made on higgsfield.ai with each participant's own credits; the page builds the prompt, hands over
// the photos to upload, and collects the result. Credits per second from Higgsfield's cost check (2026-11-14).
export const WAN_RATES = { "480p": 1, "720p": 1.75, "1080p": 3.5 };

// Per scene (= unit 1 pair key): English prompt parts with their Korean meaning. Wan 3.0 officially takes
// Chinese and English prompts, so the page assembles English and shows the Korean beside it.
export const VIDEO_SCENES = {
  street: {
    label: "길거리",
    subject: "The woman",
    subjectKo: "여자가",
    personKo: "검은 단발머리에 가벼운 앞머리, 카멜색 울 롱코트, 크림색 터틀넥, 빨간 체크 머플러를 한 20대 초반 한국 여성",
    placeKo: "눈이 조금 남은 한겨울 서울의 좁은 상점가 골목, 한글 간판들",
    person: "a Korean woman in her early 20s with a short black bob and light bangs, a camel wool long coat, a cream turtleneck and a red check scarf",
    place: "a narrow Seoul shopping alley in winter, with leftover snow and Korean shop signs",
    actions: [
      { ko: "천천히 횡단보도를 건너다 가운데서 멈춰 카메라를 본다", en: "slowly walks across the crosswalk, stops in the middle and looks into the camera" },
      { ko: "언 손을 비비며 하얀 입김을 내쉰다", en: "rubs her cold hands together and breathes out a puff of white fog" },
      { ko: "바람에 목도리가 날리자 살짝 웃으며 돌아선다", en: "smiles a little and turns around as the wind lifts her scarf" },
    ],
    details: [
      { ko: "차가운 공기에 입김이 퍼진다", en: "Her breath fogs in the cold air." },
      { ko: "작은 눈송이가 흩날린다", en: "Small snowflakes drift down." },
    ],
    sound: { ko: "조용한 골목 소음과 눈 밟는 발소리", en: "quiet alley ambience and footsteps on the snow" },
    music: false,
  },
  forest: {
    label: "숲",
    subject: "The traveler",
    subjectKo: "여행자가",
    personKo: "덥수룩한 검은 머리와 짧은 수염, 카키색 두꺼운 패딩 파카, 회색 털모자, 큰 배낭과 작은 랜턴을 든 20대 후반 한국 남성 여행자",
    placeKo: "눈 덮인 겨울 침엽수 숲속 오솔길",
    person: "a Korean male traveler in his late 20s with messy black hair and a short beard, a thick khaki hooded parka, a gray knit hat, a big backpack and a small lantern",
    place: "a snowy conifer forest path in winter",
    actions: [
      { ko: "눈길을 천천히 걸으며 위를 올려다본다", en: "walks slowly along the snowy path and looks up at the trees" },
      { ko: "멈춰서 랜턴을 들어 주위를 둘러본다", en: "stops, lifts the lantern and looks around" },
      { ko: "장갑 낀 손으로 떨어지는 눈송이를 받는다", en: "catches a falling snowflake on his gloved hand" },
    ],
    details: [
      { ko: "가지에서 눈가루가 떨어진다", en: "Snow dust falls from the branches." },
      { ko: "공기 중에 눈가루가 반짝인다", en: "Fine snow sparkles in the air." },
    ],
    sound: { ko: "나뭇가지 사이 바람 소리와 눈 밟는 소리", en: "soft wind through the trees and footsteps on snow" },
    music: false,
  },
  kpop: {
    label: "다락방",
    subject: "The idol",
    subjectKo: "아이돌이",
    personKo: "은색 긴 생머리, 반짝이는 은색 숏패딩, 검은 와이드 팬츠, 흰 퍼 부츠를 신은 20대 초반 한국 여성 K-pop 아이돌",
    placeKo: "경사진 흰 천장, 동그란 연보라 러그, 빈백, 꼬마전구가 있는 작은 다락방 세트",
    person: "a Korean K-pop idol woman in her early 20s with long straight silver hair, a shiny silver cropped puffer jacket, black wide pants and white fur boots",
    place: "a small attic room set with a sloped white ceiling, a round lilac rug, beanbags and string lights",
    actions: [
      { ko: "러그 위에서 짧고 힘있는 안무 동작을 하고 포즈로 멈춘다", en: "does a short, sharp dance move on the rug and freezes in a pose" },
      { ko: "한 바퀴 돌고 카메라를 가리킨다", en: "spins once and points at the camera" },
      { ko: "주머니에 손을 넣고 비트에 맞춰 몸을 좌우로 흔든다", en: "sways side to side to the beat with her hands in her jacket pockets" },
    ],
    details: [
      { ko: "꼬마전구가 반짝인다", en: "The string lights twinkle." },
      { ko: "창밖으로 눈이 내린다", en: "Snow falls outside the round window." },
    ],
    sound: { ko: "경쾌한 K-pop 비트", en: "an upbeat K-pop style beat" },
    music: true,
  },
  office: {
    label: "오피스",
    subject: "The man",
    subjectKo: "남자가",
    personKo: "단정하게 넘긴 짧은 머리, 회색 터틀넥, 차콜 슬랙스, 목에 건 사원증, 팔에 걸친 남색 울 코트의 30대 한국 남성 회사원",
    placeKo: "눈 내리는 겨울 오후의 창가 사무실 책상",
    person: "a Korean office worker in his 30s with neatly combed short hair, a gray turtleneck, charcoal slacks, an ID badge on a lanyard and a navy wool coat over his arm",
    place: "a window-side office desk on a snowy winter afternoon",
    actions: [
      { ko: "노트북에서 고개를 들어 창밖을 보고 머그컵을 든다", en: "looks up from the laptop, glances out the window and lifts the mug" },
      { ko: "두 팔을 뻗어 기지개를 켜고 의자에 기댄다", en: "stretches both arms and leans back in the chair" },
      { ko: "모니터를 보다가 작게 웃는다", en: "looks at the monitor and breaks into a small smile" },
    ],
    details: [
      { ko: "머그컵에서 김이 오른다", en: "Steam rises from the mug." },
      { ko: "창밖으로 눈이 내린다", en: "Snow falls outside the window." },
    ],
    sound: { ko: "키보드 소리와 잔잔한 사무실 소음", en: "keyboard clicks and a quiet office hum" },
    music: false,
  },
};

export const CAMERA_MOVES = [
  { ko: "고정", koSentence: "카메라는 고정되어 있다.", en: "Fixed camera.", term: "fixed camera", desc: "카메라가 움직이지 않는다" },
  { ko: "밀고 들어가기", koSentence: "카메라가 인물에게 천천히 다가간다.", en: "The camera slowly pushes in toward them.", term: "push in", desc: "인물에게 천천히 다가간다" },
  { ko: "뒤로 빠지기", koSentence: "카메라가 천천히 뒤로 빠지며 장소를 보여 준다.", en: "The camera slowly pulls back to reveal the place.", term: "pull back", desc: "멀어지며 장소가 드러난다" },
  { ko: "좌우로 돌리기", koSentence: "카메라가 왼쪽에서 오른쪽으로 천천히 돈다.", en: "The camera slowly pans from left to right.", term: "pan", desc: "제자리에서 고개를 돌리듯" },
  { ko: "따라가기", koSentence: "카메라가 인물 옆에서 함께 이동한다.", en: "Tracking shot: the camera moves alongside them.", term: "tracking shot", desc: "걷는 인물을 옆이나 뒤에서 따라간다" },
  { ko: "둘레 돌기", koSentence: "카메라가 인물 주위를 천천히 반 바퀴 돈다.", en: "The camera slowly orbits halfway around them.", term: "orbit", desc: "인물 주위를 반 바퀴 돈다" },
  { ko: "들고 찍기", koSentence: "손에 들고 찍은 듯 카메라가 살짝 흔들린다.", en: "Handheld camera with a gentle, natural sway.", term: "handheld", desc: "살짝 흔들리는 현장감" },
  { ko: "위로 올라가기", koSentence: "카메라가 천천히 위로 올라가며 내려다본다.", en: "The camera slowly cranes up to a high angle.", term: "crane up", desc: "높이 올라가며 내려다본다" },
];

export const SHOT_SIZES = [
  { ko: "풀샷", koSentence: "풀샷, 머리부터 발끝까지.", en: "Full shot, head to toe." },
  { ko: "미디엄 샷", koSentence: "허리 위 미디엄 샷.", en: "Medium shot from the waist up." },
  { ko: "클로즈업", koSentence: "얼굴 클로즈업.", en: "Close-up on the face." },
  { ko: "와이드", koSentence: "와이드 샷, 장소 안에 인물이 작게.", en: "Wide shot, the person small in the place." },
];

export const NEGATIVES = [
  { ko: "자막", en: "subtitles" },
  { ko: "글자", en: "text" },
  { ko: "워터마크", en: "watermark" },
  { ko: "다른 사람", en: "extra people" },
  { ko: "로고", en: "logos" },
];

const VB_FF = "lv1:u3:vb:ff";        // builder state keys (read by the final builder and the summary)
const VB_REF = "lv1:u3:vb:ref";
const VB_FINAL = "lv1:u3:vb:final";

export const LEVEL = {
  id: "lv1",
  no: 1,
  title: "Lv.1 AI 이미지 · 영상 첫걸음",
  units: [
    {
      id: "u1",
      code: "1-1",
      title: "AI 이미지 모델 써보기",
      goal: "영상에 쓸 인물 샷 1장, 장소 샷 1장 만들기",
      minutes: 25,
      steps: [
        {
          id: "s1",
          tab: "인트로",
          title: "이번 유닛에서 할 일",
          minutes: 2,
          blocks: [
            {
              type: "lead",
              text: "영상 AI는 인물의 얼굴과 옷, 장소의 분위기를 <b>참고 이미지</b>에서 가져와요. 이번 유닛에서는 그 참고 이미지를 직접 만들어요. 인물을 한 명 만들고, 장소·스타일·분위기를 바꿔 보면서 다음 유닛 영상에 쓸 사진 두 장을 골라요.",
            },
            {
              type: "make",
              title: "이번 유닛이 끝나면 갖게 되는 것",
              items: [
                { icon: "person", title: "인물 샷 1장", desc: "단순한 배경에 전신이 보이는 내 주인공" },
                { icon: "place", title: "장소 샷 1장", desc: "그 주인공이 장소 안에 들어간 장면" },
              ],
            },
            {
              type: "flow",
              title: "진행 순서",
              items: ["인물 만들기", "장소에 넣기", "스타일 바꾸기", "분위기 바꾸기", "두 장 고르기"],
            },
            {
              type: "tip",
              title: "모델은 세 가지 중에서 골라 써요",
              text: "Seedream 5.5 · GPT Image 2.6 · Nano Banana 2.1. 지금은 아무거나 골라도 괜찮아요. 셋의 차이는 다음 유닛에서 같은 프롬프트로 직접 비교해 봐요.",
            },
          ],
        },
        {
          id: "s2",
          tab: "인물 만들기",
          title: "주인공 인물 만들기",
          goal: "영상의 주인공이 될 인물 한 명을 만든다",
          minutes: 6,
          blocks: [
            {
              type: "guide",
              title: "참고용 인물 사진은 이렇게 만들어요",
              items: [
                "<b>전신</b>이 다 보이게: 나중에 영상에서 걷거나 움직일 때 옷과 신발까지 필요해요.",
                "<b>단순한 무지 배경</b>: 배경이 복잡하면 영상 AI가 배경까지 따라 그려요.",
                "<b>정면에 가까운 자세</b>: 얼굴과 옷이 잘 보여야 다음 장면에서도 같은 사람으로 나와요.",
              ],
            },
            {
              type: "anatomy",
              title: "인물 프롬프트의 뼈대",
              parts: [
                { label: "누가", text: "20대 초반 한국 여성", color: "a" },
                { label: "얼굴 · 머리", text: "검은 단발머리, 가벼운 앞머리", color: "b" },
                { label: "옷 · 소품", text: "카멜색 울 코트, 체크 머플러, 작은 가방", color: "c" },
                { label: "표정 · 자세", text: "카메라를 보며 살짝 웃음", color: "d" },
                { label: "구도", text: "머리부터 발끝까지 전신, 정면", color: "e" },
                { label: "배경", text: "밝은 회색 무지 배경", color: "f" },
                { label: "스타일", text: "부드러운 자연광, 실사 사진", color: "g" },
              ],
            },
            {
              type: "generator",
              id: "person",
              tag: "person",
              title: "만들어 보기",
              hint: "예시를 하나 누르고, 옷이나 머리 같은 부분을 내 마음대로 바꿔 보세요. 예시마다 다음 스텝에서 어울리는 장소가 정해져 있어요.",
              examples: PERSON_EXAMPLES,
              aspect: "2:3",
              aspects: ["2:3", "3:4", "1:1"],
            },
            {
              type: "tip",
              title: "마음에 안 들면 한 군데만 바꿔서 다시",
              text: "여러 곳을 한꺼번에 바꾸면 무엇 때문에 좋아졌는지 알 수 없어요. 옷만, 또는 표정만 바꿔서 다시 생성해 보세요.",
            },
            {
              type: "check",
              id: "s2check",
              title: "내 인물 사진에 있나요?",
              items: ["머리부터 발끝까지 다 보인다", "배경이 단순한 단색이다", "얼굴이 또렷하게 보인다"],
              note: "빠진 게 있다면 프롬프트의 그 부분을 더 분명하게 써서 다시 만들어 보세요.",
            },
          ],
        },
        {
          id: "s3",
          tab: "장소에 넣기",
          title: "주인공을 장소에 넣기",
          goal: "방금 만든 인물을 그대로 둔 채, 장소 안에 넣는다",
          minutes: 6,
          blocks: [
            {
              type: "guide",
              title: "인물 사진을 첨부해서 같은 사람으로 만들어요",
              items: [
                "스텝 2에서 만든 인물 사진이 <b>참고 이미지</b>로 자동으로 들어가요.",
                "<b>인물과 어울리는 장소</b>를 골라요. 옷차림, 나이, 하는 일이 장소와 맞아야 자연스러워요. 회사원은 오피스, 아이돌은 뮤비 세트처럼요.",
                "프롬프트 첫 문장에 <b>\"첨부한 인물을 그대로 둔다\"</b>를 꼭 넣어요. 이 문장이 없으면 다른 사람이 나오기 쉬워요.",
                "장소는 <b>눈에 보이는 물건 세 가지</b> 이상으로 묘사해요. 예: 한글 간판, 전깃줄, 길가에 쌓인 눈.",
                "장소도 <b>사진으로</b> 넣을 수 있어요. K-pop 예시는 미리 만들어 둔 세트 사진(작은 다락방)이 <b>장소 참고 이미지</b>로 함께 들어가요. 글로 설명하는 것보다 훨씬 똑같이 나와요.",
              ],
            },
            {
              type: "anatomy",
              title: "장소 프롬프트의 뼈대",
              parts: [
                { label: "인물 유지", text: "첨부한 인물을 그대로 둔다", color: "a" },
                { label: "어디서 · 무엇을", text: "상점가 골목에서 횡단보도를 건넌다", color: "b" },
                { label: "보이는 물건", text: "한글 간판, 전깃줄, 길가에 쌓인 눈", color: "c" },
                { label: "카메라", text: "인물은 가운데 전신, 눈높이", color: "e" },
                { label: "스타일", text: "실사 사진", color: "g" },
              ],
            },
            {
              type: "generator",
              id: "place",
              tag: "place",
              title: "만들어 보기",
              hint: "내 인물과 어울리는 장소가 표시돼 있어요. 다른 장소를 쓰고 싶다면 인물의 옷차림과 행동이 어색하지 않게 고쳐 써 보세요.",
              examples: PLACE_EXAMPLES,
              pairFrom: "person",
              aspect: "16:9",
              aspects: ["16:9", "9:16", "3:2"],
              ref: { from: ["person"], required: true, label: "참고 이미지: 내 인물" },
            },
            {
              type: "check",
              id: "s3check",
              title: "내 장소 사진에 있나요?",
              items: [
                "스텝 2의 인물과 같은 사람으로 보인다",
                "인물의 옷차림과 행동이 장소와 어울린다",
                "장소의 물건이 세 가지 이상 보인다",
                "인물이 화면에서 잘 보이는 위치에 있다",
              ],
              note: "얼굴이 달라졌다면 \"얼굴, 머리, 옷이 같아야 한다\"를 문장 앞쪽에 한 번 더 써 보세요.",
            },
          ],
        },
        {
          id: "s4",
          tab: "스타일 바꾸기",
          title: "같은 장면, 다른 스타일",
          goal: "장면은 그대로 두고 스타일만 바꿔서 실사와 애니메이션을 비교한다",
          minutes: 5,
          blocks: [
            {
              type: "guide",
              title: "스타일은 마지막 한 줄로 바꿔요",
              items: [
                "장면 내용은 <b>스텝 3의 사진</b>이 참고 이미지로 들고 가요. 프롬프트에서는 스타일만 바꿔요.",
                "스타일은 <b>매체 + 질감 + 빛</b> 세 가지로 써요. 예: \"일본 TV 애니메이션 셀화(매체), 깨끗한 선과 단순한 음영(질감), 밝은 낮 빛(빛)\".",
                "<b>A와 B는 스타일 줄만 다르게</b> 두어야 비교가 돼요.",
              ],
            },
            {
              type: "ab",
              id: "style",
              tag: "style",
              title: "A / B 비교하기",
              base: SAME_SCENE,
              aspect: "16:9",
              ref: { from: ["place"], required: true, label: "참고 이미지: 스텝 3의 장소 사진" },
              slots: [
                {
                  label: "A",
                  default: 0,
                  presets: [
                    { label: "실사 사진", text: "스타일: 35mm 필름 카메라로 찍은 실사 사진, 피부와 옷감 질감이 보이는, 자연스러운 빛." },
                    { label: "실사 · 영화 스틸", text: "스타일: 영화의 한 장면 같은 실사 스틸, 얕은 심도, 부드러운 필름 그레인." },
                  ],
                },
                {
                  label: "B",
                  default: 0,
                  presets: [
                    { label: "2D 애니메이션", text: "스타일: 일본 TV 애니메이션 셀화, 깨끗한 선, 한두 단계의 단순한 음영, 손으로 그린 배경." },
                    { label: "3D 애니메이션", text: "스타일: 3D 애니메이션 영화, 둥글고 단순한 형태, 부드러운 조명, 매끈한 재질." },
                    { label: "수채 일러스트", text: "스타일: 수채화 일러스트, 번지는 물감, 종이 질감, 옅은 색." },
                  ],
                },
              ],
            },
            {
              type: "tip",
              title: "비교해 볼 것",
              text: "인물의 얼굴·옷과 장소 배치가 A와 B에서 그대로 유지됐나요? 스타일 줄만 바꿨는데 내용이 바뀌었다면, 기본 문장에 \"그대로 둔다\"를 더 분명하게 써 보세요.",
            },
          ],
        },
        {
          id: "s5",
          tab: "분위기 바꾸기",
          title: "같은 장면, 다른 분위기",
          goal: "시간·날씨·조명·재질을 바꿔서 분위기가 어떻게 달라지는지 본다",
          minutes: 5,
          blocks: [
            {
              type: "guide",
              title: "분위기는 빛이 만들어요",
              items: [
                "빛은 <b>어디서 오는지 + 무슨 색인지</b>로 써요. 예: \"낮은 햇살이 왼쪽에서, 금빛으로\".",
                "야외라면 <b>시간</b>(오전 / 오후)과 <b>날씨</b>(비, 눈, 안개)를 바꿔 보세요.",
                "실내라면 <b>조명</b>(형광등, 네온, 창가 햇빛)과 <b>재질</b>(콘크리트, 원목, 유리)을 바꿔 보세요.",
              ],
            },
            {
              type: "ab",
              id: "mood",
              tag: "mood",
              title: "A / B 비교하기",
              base: SAME_SCENE + " 스타일도 그대로 둔다.",
              aspect: "16:9",
              ref: { from: ["place", "style"], required: true, label: "참고 이미지: 장소 사진" },
              slots: [
                {
                  label: "A",
                  default: 0,
                  presets: [
                    { group: "야외 · 시간", label: "맑은 오전", text: "분위기: 맑은 날 오전 9시. 낮은 햇살이 한쪽에서 들어오고 그림자가 짧고 선명하다. 시원하고 깨끗한 색." },
                    { group: "야외 · 날씨", label: "비 오는 저녁", text: "분위기: 비 오는 저녁. 젖은 바닥에 가게 불빛이 길게 비친다. 차갑고 촉촉한 색." },
                    { group: "야외 · 날씨", label: "새벽 안개", text: "분위기: 새벽 안개. 멀리 있는 것이 흐릿하게 사라지고 빛이 부드럽게 퍼진다." },
                    { group: "실내 · 조명", label: "형광등", text: "분위기: 천장 형광등의 차갑고 평평한 빛. 그림자가 거의 없고 약간 푸르스름하다." },
                    { group: "실내 · 재질", label: "노출 콘크리트", text: "분위기: 노출 콘크리트 벽과 바닥, 회색의 차가운 질감, 창으로 들어오는 흐린 빛." },
                  ],
                },
                {
                  label: "B",
                  default: 0,
                  presets: [
                    { group: "야외 · 시간", label: "늦은 오후", text: "분위기: 늦은 오후 5시. 금빛 햇살이 낮게 깔리고 그림자가 길게 늘어진다. 따뜻한 색." },
                    { group: "야외 · 날씨", label: "눈 오는 오후", text: "분위기: 눈 내리는 흐린 오후. 하얀 하늘, 부드러운 빛, 어깨에 쌓이는 눈송이." },
                    { group: "실내 · 조명", label: "네온 · 연기", text: "분위기: 보라색과 파란색 네온 조명, 바닥에 깔린 연기, 강한 색 대비." },
                    { group: "실내 · 조명", label: "창가 햇살", text: "분위기: 창가로 들어오는 오후 햇살, 바닥에 창틀 그림자, 공기 중 먼지가 빛난다." },
                    { group: "실내 · 재질", label: "원목 · 벨벳", text: "분위기: 따뜻한 원목 가구와 짙은 벨벳 커튼, 은은한 스탠드 조명." },
                  ],
                },
              ],
            },
            {
              type: "tip",
              title: "실내 장면을 골랐다면",
              text: "K-pop 세트나 오피스처럼 실내 장소를 만들었다면 '실내' 프리셋을, 길거리나 숲이라면 '야외' 프리셋을 골라 보세요. 직접 고쳐 써도 좋아요.",
            },
          ],
        },
        {
          id: "s6",
          tab: "두 장 고르기",
          title: "영상에 쓸 두 장 고르기",
          goal: "가장 마음에 드는 인물 샷과 장소 샷을 하나씩 저장한다",
          minutes: 3,
          blocks: [
            {
              type: "guide",
              title: "다음 유닛에서 이 두 장으로 영상을 만들어요",
              items: [
                "<b>인물 샷</b>: 스텝 2에서 만든 사진 중 하나. 영상 속 주인공의 얼굴과 옷이 이 사진을 따라가요.",
                "<b>장소 샷</b>: 스텝 3~5에서 만든 사진 중 하나. 영상의 장소와 분위기가 이 사진을 따라가요.",
                "다른 곳에서 만든 사진을 쓰고 싶다면 직접 올려도 돼요.",
              ],
            },
            {
              type: "pick",
              id: "unit1pick",
              slots: [
                { key: "person", label: "인물 샷", from: ["person"] },
                { key: "place", label: "장소 샷", from: ["place", "style", "mood"] },
              ],
            },
            {
              type: "check",
              id: "finalcheck",
              title: "마무리 체크",
              items: [
                "인물 샷: 전신이 보이고 배경이 단순하다",
                "인물 샷: 얼굴과 옷이 또렷하다",
                "장소 샷: 인물 샷과 같은 사람이다",
                "장소 샷: 장소의 물건과 빛의 방향이 느껴진다",
                "두 장 모두 내 컴퓨터에 내려받았다",
              ],
              note: "빠진 게 있다면 해당 스텝으로 돌아가서 한 부분만 고쳐 다시 만들어 보세요.",
            },
          ],
        },
      ],
    },
    {
      id: "u2",
      code: "1-2",
      title: "이미지 모델 비교하기",
      goal: "세 모델을 나란히 비교하고, 나만의 모델 선택표 만들기",
      minutes: 20,
      steps: [
        {
          id: "s1",
          tab: "인트로",
          title: "이번 유닛에서 할 일",
          minutes: 2,
          blocks: [
            {
              type: "lead",
              text: "영상 레퍼런스를 만들 때 어떤 모델을 쓸지는 직접 비교해 봐야 알 수 있어요. 이번 유닛에서는 <b>같은 프롬프트를 세 모델에 한 번에</b> 넣고, 이름을 가린 채 결과를 골라요. 네 가지를 비교하고 나면 나만의 모델 선택표가 남아요.",
            },
            {
              type: "make",
              title: "이번 유닛이 끝나면 갖게 되는 것",
              items: [
                { icon: "grid", title: "네 번의 비교", desc: "실사감 · 인물 유지 · 한글 · 부분 수정" },
                { icon: "table", title: "나만의 모델 선택표", desc: "어떤 일에 어떤 모델을 쓸지 정한 표" },
              ],
            },
            {
              type: "flow",
              title: "진행 순서",
              items: ["실사감", "인물 유지", "한국어 글자", "부분 수정", "속도와 가격", "선택표"],
            },
            {
              type: "guide",
              title: "비교는 이렇게 진행돼요",
              items: [
                "버튼 하나로 <b>세 모델이 동시에</b> 만들어요. 20~30초쯤 걸려요.",
                "결과는 <b>모델 이름을 가린 채</b> A · B · C로 보여 줘요. 순서는 매번 섞여요.",
                "한 장을 고르고 <b>고른 이유</b>를 누르면 이름이 공개돼요.",
                "기다리는 동안 각 스텝의 <b>보는 포인트</b>를 읽어 두세요.",
              ],
            },
            {
              type: "table",
              title: "세 모델 스펙",
              head: ["", "Seedream 5.5", "GPT Image 2.6", "Nano Banana 2.1"],
              rows: [
                ["만든 곳", "바이트댄스", "OpenAI", "구글"],
                ["최대 해상도", "2K", "4K", "4K"],
                ["참고 이미지", "최대 10장", "최대 16장", "최대 14장"],
                ["눈에 띄는 기능", "투명 배경 PNG", "투명 배경, GIF · SVG 출력", "마스크로 부분 수정, 영상을 참고로 넣기"],
              ],
              note: "출처: 힉스필드 모델 정보 (2026-11-14 확인)",
            },
            {
              type: "tip",
              title: "어느 모델이 더 좋은지는 표에 없어요",
              text: "표에는 사실만 적었어요. 품질은 직접 보고 골라요. 같은 모델도 프롬프트에 따라 결과가 크게 달라져요.",
            },
          ],
        },
        {
          id: "s2",
          tab: "실사감",
          title: "같은 프롬프트, 세 모델",
          goal: "실사감 비교: 같은 인물 프롬프트를 세 모델에 넣고 한 장을 고른다",
          minutes: 3,
          blocks: [
            {
              type: "guide",
              title: "보는 포인트",
              items: [
                "<b>피부와 머리카락 질감</b>: 사진처럼 보이는지, 매끈한 그림처럼 보이는지",
                "<b>색감</b>: 자연스러운지, 과하게 진하거나 바랬는지",
                "<b>구도</b>: 머리부터 발끝까지 잘리지 않았는지",
                "<b>빠진 것</b>: 프롬프트에 적은 가방, 앞머리, 소품이 다 있는지",
              ],
            },
            {
              type: "compare",
              id: "real",
              title: "세 모델로 만들기",
              hint: "유닛 1에서 쓴 내 인물 프롬프트를 불러왔어요. 비어 있다면 예시를 하나 눌러 주세요.",
              examples: PERSON_EXAMPLES,
              promptFrom: U1_PERSON_PROMPT,
              aspect: "2:3",
              reasons: ["질감", "색감", "구도", "프롬프트를 잘 따름"],
              example: EXAMPLE_REAL,
            },
          ],
        },
        {
          id: "s3",
          tab: "인물 유지",
          title: "같은 인물 유지하기",
          goal: "인물 유지 비교: 내 인물 샷을 참고로 넣고 다른 샷을 만들어, 같은 사람이 나오는지 본다",
          minutes: 4,
          blocks: [
            {
              type: "guide",
              title: "이 유닛에서 가장 중요한 비교예요",
              items: [
                "영상은 컷마다 <b>같은 사람</b>이어야 해요. 참고 이미지를 얼마나 잘 따르는지가 모델 선택에서 가장 중요해요.",
                "유닛 1에서 고른 <b>인물 샷</b>이 참고 이미지로 자동으로 들어가요. 결과 옆에 원본이 같이 놓여요.",
                "배경은 무지로 두어 장소가 아니라 <b>사람만</b> 비교해요.",
                "보는 포인트: 같은 사람으로 보이는지(눈매, 얼굴형) · 머리 길이와 색 · 옷 디테일(단추, 무늬, 가방이나 사원증 같은 소품)",
              ],
            },
            {
              type: "compare",
              id: "identity",
              title: "세 모델로 만들기",
              hint: "샷을 하나 고르세요. 화면 비율은 샷에 맞춰 바뀌어요.",
              examples: SHOT_EXAMPLES,
              ref: { from: ["person"], prefer: U1_PICK_PERSON, sample: "assets/sample_person.jpg", required: true, label: "참고 이미지: 내 인물 샷" },
              showRef: true,
              aspect: "3:4",
              reasons: ["얼굴", "머리", "옷 디테일"],
              example: EXAMPLE_IDENTITY,
            },
          ],
        },
        {
          id: "s4",
          tab: "한국어 글자",
          title: "한국어 글자 넣기",
          goal: "한글 비교: 사람 없는 장소 샷에 짧은 한글을 넣고, 글자가 정확한지 본다",
          minutes: 3,
          blocks: [
            {
              type: "guide",
              title: "장소를 사람 없이 다시 만들면서 한글을 넣어요",
              items: [
                "내 인물과 <b>짝인 장소</b>가 미리 골라져 있어요. 다른 장소를 골라도 괜찮아요.",
                "참고 이미지 없이 새로 만들어요. 화면 비율은 16:9예요.",
                "보는 포인트: 글자가 <b>한 자도 틀리지 않았는지</b> · 크기와 위치가 장소에 자연스러운지",
              ],
            },
            {
              type: "compare",
              id: "hangul",
              title: "세 모델로 만들기",
              examples: TEXT_EXAMPLES,
              pairFrom: "person",
              aspect: "16:9",
              reasons: ["글자 정확", "자연스러움"],
              example: EXAMPLE_HANGUL,
            },
            {
              type: "tip",
              title: "글자는 레퍼런스 이미지에서 미리 잡아 두세요",
              text: "넣을 글자는 따옴표 안에 정확히 적어요. 짧을수록 정확해요. 영상 모델은 글자를 잘 깨뜨려서, 간판 같은 글자는 레퍼런스 이미지에서 미리 만들어 두는 게 좋아요. 사람 없는 장소 샷은 그대로 장소 레퍼런스로도 쓸 수 있어요.",
            },
          ],
        },
        {
          id: "s5",
          tab: "부분 수정",
          title: "한 군데만 고치기",
          goal: "부분 수정 비교: 내 장소 샷에서 딱 한 가지만 바꿔 달라고 하고, 나머지가 그대로인지 본다",
          minutes: 3,
          blocks: [
            {
              type: "guide",
              title: "말한 것만 바뀌었는지 찾아보세요",
              items: [
                "유닛 1에서 고른 <b>장소 샷</b>이 참고 이미지로 들어가요. 화면 비율은 원본에 맞춰요.",
                "\"아래 한 가지만 바꾸고 나머지는 그대로 둔다\"로 시작해서 <b>딱 한 가지</b>만 바꿔 달라고 해요.",
                "결과마다 <b>원본과 번갈아 보기</b>를 눌러 바뀐 곳을 찾아보세요.",
                "보는 포인트: 말한 것만 바뀌었는지 · 얼굴과 배경 디테일(간판, 소품)이 그대로인지",
              ],
            },
            {
              type: "compare",
              id: "edit",
              title: "세 모델로 고치기",
              examples: EDIT_EXAMPLES,
              ref: { from: ["place", "style", "mood"], prefer: U1_PICK_PLACE, sample: "assets/sample_place.jpg", required: true, label: "참고 이미지: 내 장소 샷" },
              aspect: "ref",
              toggleRef: true,
              reasons: ["말한 것만 바뀜", "얼굴 유지", "배경 유지"],
              example: EXAMPLE_EDIT,
            },
            {
              type: "tip",
              title: "나중에 영상 레퍼런스를 고칠 때도 이렇게 해요",
              text: "거의 마음에 드는 사진은 처음부터 다시 만들지 말고 한 군데만 고쳐 달라고 하세요. 여러 군데를 한꺼번에 고치면 다른 곳까지 바뀌기 쉬워요.",
            },
          ],
        },
        {
          id: "s6",
          tab: "속도와 가격",
          title: "속도와 가격",
          goal: "지금까지 만든 기록으로 모델별 시간과 가격을 본다",
          minutes: 2,
          blocks: [
            {
              type: "guide",
              title: "이 표는 내가 만든 기록으로 채워져요",
              items: [
                "<b>평균 시간</b>: 이 페이지에서 지금까지 만든 이미지 기준이에요.",
                "<b>고른 횟수</b>: 스텝 2~5에서 내가 고른 결과예요.",
                "<b>힉스필드 크레딧</b>: 나중에 내 힉스필드 계정으로 한 장 만들 때 드는 크레딧이에요.",
              ],
            },
            {
              type: "stats",
              picks: ["real", "identity", "hangul", "edit"],
              credits: HF_CREDITS,
              checked: CREDITS_CHECKED,
              creditNote: CREDITS_NOTE,
            },
            {
              type: "tip",
              title: "시도할 때는 빠르고 싼 모델로",
              text: "여러 번 돌려 볼 때는 빠르고 싼 모델로, 마지막 한 장은 가장 마음에 든 모델로 뽑아요. 해상도나 품질을 올리면 크레딧도 올라가요.",
            },
          ],
        },
        {
          id: "s7",
          tab: "선택표",
          title: "나만의 모델 선택표",
          goal: "고른 결과를 표로 정리하고, 다음 유닛부터 쓸 기본 모델을 정한다",
          minutes: 3,
          blocks: [
            {
              type: "summary",
              rows: [
                { id: "real", label: "실사감" },
                { id: "identity", label: "인물 유지" },
                { id: "hangul", label: "한글" },
                { id: "edit", label: "부분 수정" },
              ],
            },
            {
              type: "check",
              id: "finalcheck",
              title: "마무리 체크",
              items: [
                "모델 이름을 가리고 골라 봤다",
                "인물 유지가 가장 좋았던 모델을 안다",
                "한글이 정확했던 모델을 안다",
                "다음 유닛에서 쓸 기본 모델을 정했다",
                "선택표를 내려받았다",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "u3",
      code: "1-3",
      title: "힉스필드로 첫 영상",
      goal: "내 인물 샷과 장소 샷으로 5~10초 영상 한 편 만들기 (Wan 3.0)",
      minutes: 27,
      steps: [
        {
          id: "s1",
          tab: "인트로",
          title: "이번 유닛에서 할 일",
          minutes: 2,
          blocks: [
            {
              type: "lead",
              text: "오늘은 사진을 <b>영상</b>으로 만들어요. 재료는 유닛 1에서 고른 인물 샷과 장소 샷이에요. 영상은 <b>힉스필드</b>에서 내 계정 크레딧으로 만들고, 이 페이지는 프롬프트를 만들어 주고 결과를 모아 줘요.",
            },
            {
              type: "make",
              title: "이번 유닛이 끝나면 갖게 되는 것",
              items: [
                { icon: "video", title: "내 첫 영상 한 편", desc: "720p, 5~10초, 소리까지 함께" },
                { icon: "note", title: "그 영상의 프롬프트", desc: "다음 유닛과 모델 비교에서 다시 써요" },
              ],
            },
            {
              type: "table",
              title: "오늘 쓰는 모델: Wan 3.0",
              head: ["항목", "내용"],
              rows: [
                ["만드는 방식", "글로만 / 첫 프레임(+끝 프레임) / 참고 이미지(최대 10장). 첫 프레임과 참고 이미지는 같이 쓸 수 없어요"],
                ["길이", "2~30초. 오늘은 5초로 연습하고, 마지막 한 편만 5~10초"],
                ["해상도와 크레딧", "480p 초당 1 · 720p 초당 1.75 · 1080p 초당 3.5 (5초면 5 · 8.75 · 17.5)"],
                ["Wan 3.0 Prime과 헷갈리지 않기", "같은 회사의 상위 버전이에요. 480p 초당 1.5 · 720p 초당 3 · 1080p 초당 6으로 1.5배 넘게 비싸요. 오늘은 이름에 Prime이 없는 Wan 3.0을 써요"],
                ["소리", "영상과 함께 만들어요(기본 켜짐). 꺼도 가격은 같아요"],
                ["생각하기", "느리지만 프롬프트를 더 잘 따라요. 가격은 같아요"],
                ["프롬프트 언어", "공식 지원은 중국어와 영어지만 한국어도 잘 따라요(운영진 시험). 이 페이지는 한국어와 영어 문장을 둘 다 만들어요"],
              ],
              note: "힉스필드 모델 정보와 비용 조회 기준 (2026-11-14)",
            },
            {
              type: "tip",
              title: "오늘 쓰는 크레딧은 20~35 정도예요",
              text: "연습은 480p 5초(5크레딧)로 두세 번, 마지막 한 편만 720p(5초 8.75, 10초 17.5)로 만들어요. 크레딧이 모자라면 운영진에게 알려 주세요.",
            },
          ],
        },
        {
          id: "s2",
          tab: "준비",
          title: "힉스필드 준비",
          goal: "힉스필드에서 Wan 3.0 영상 만들기 화면을 열고 설정을 맞춘다",
          minutes: 3,
          blocks: [
            {
              type: "hfguide",
              title: "힉스필드에서 순서대로",
              steps: [
                { title: "로그인하고 크레딧 확인", text: "higgsfield.ai에 로그인해요. 오른쪽 위 프로필 사진을 누르면 남은 크레딧이 보여요. 40 이상인지 봐요.",
                  img: "assets/hf/hf_login_credits.jpg" },
                { title: "비디오 화면에서 Wan 3.0 고르기", text: "위쪽 메뉴에서 비디오를 눌러요. 아래쪽 모델 칸을 눌러 Wan 3.0을 골라요. 처음에는 Wan 3.0 Prime이 골라져 있을 수 있어요. Prime은 크레딧이 1.5배 넘게 드니까 이름에 Prime이 없는 것을 골라요.",
                  img: "assets/hf/hf_video_wan.jpg" },
                { title: "설정 맞추기", text: "모델 칸 아래에서 길이는 5s, 품질은 480p로 바꿔요. 프롬프트 칸 아래 소리는 켬으로 둬요. 비율이나 생각하기 칸이 보이면 16:9, 끔으로 둬요. 연습은 싸게 하고 마지막 한 편만 화질을 올려요." },
              ],
            },
            {
              type: "guide",
              title: "올릴 사진은 다음 스텝에서 바로 내려받을 수 있어요",
              items: [
                "유닛 1에서 고른 <b>인물 샷</b>과 <b>장소 샷</b>을 써요. 스텝 4와 5에 사진과 내려받기 버튼이 있어요.",
                "유닛 1을 건너뛰었다면 예시 사진이 대신 들어가 있어요.",
                "릴스용 세로 영상(9:16)도 돼요. 다만 유닛 1의 장소 샷이 가로(16:9)라서 오늘은 16:9가 자연스러워요.",
              ],
            },
          ],
        },
        {
          id: "s3",
          tab: "공식",
          title: "영상 프롬프트 공식",
          goal: "영상 프롬프트를 동작, 카메라, 소리로 나눠 쓰는 법을 안다",
          minutes: 3,
          blocks: [
            {
              type: "anatomy",
              title: "영상 프롬프트의 뼈대",
              parts: [
                { label: "누가", text: "목도리를 두른 여자가", color: "a" },
                { label: "무엇을 (동작 하나)", text: "천천히 횡단보도를 건너다 멈춰 카메라를 본다", color: "b" },
                { label: "카메라 (하나만)", text: "카메라는 고정", color: "e" },
                { label: "소리", text: "골목 소음과 발소리, 대사·배경음악 없음", color: "d" },
              ],
            },
            {
              type: "guide",
              title: "규칙 다섯 가지",
              items: [
                "<b>형용사 대신 동사와 속도</b>를 써요. \"아름다운\"보다 \"천천히 걷다가 멈춘다\"가 움직임을 만들어요.",
                "<b>5초에는 동작 하나</b>. 6~10초는 동작 한두 개예요.",
                "<b>카메라 움직임은 한 번에 하나</b>. 두 개를 쓰면 모델이 하나만 고르거나 이상하게 섞어요.",
                "<b>해상도와 길이는 글로 쓰지 않아요</b>. 설정에서 골라요. \"4K\"라고 써도 효과가 없어요.",
                "<b>원하지 않는 소리는 적어서 막아요</b>: \"No dialogue. No background music.\" (대사 없음, 배경음악 없음)",
              ],
            },
            { type: "cards", title: "카메라 움직임 카드", items: CAMERA_MOVES },
            {
              type: "tip",
              title: "출처",
              text: "Wan 3.0 프롬프트 가이드(wan30.video)의 공식과 흔한 실수에서 뽑았어요.",
            },
          ],
        },
        {
          id: "s4",
          tab: "첫 프레임",
          title: "첫 프레임으로 움직이기",
          goal: "내 장소 샷을 첫 프레임으로 넣고, 움직임과 카메라와 소리만 써서 5초 영상을 만든다",
          minutes: 5,
          blocks: [
            {
              type: "guide",
              title: "사진이 그대로 영상의 첫 장면이 돼요",
              items: [
                "힉스필드에서 <b>프레임</b> 탭을 누르고 <b>시작 프레임</b> 칸에 내 장소 샷을 올려요. 종료 프레임은 비워 둬요.",
                "프롬프트에는 <b>움직임, 카메라, 소리만</b> 써요. 사진에 이미 있는 옷이나 장소를 다시 설명하지 않아요. 다시 설명하는 게 이 방식의 가장 흔한 실수예요.",
                "아래에서 칩을 고르면 문장이 만들어져요. <b>복사</b>해서 힉스필드 프롬프트 칸에 붙여넣어요. 칸에 다른 글이 남아 있으면 먼저 지워요. 한국어가 기본이고, 영어로도 바꿀 수 있어요.",
              ],
            },
            {
              type: "videoex",
              title: "예시: 같은 사진, 한국어 프롬프트와 영어 프롬프트",
              note: "운영진이 Wan 3.0 · 480p · 5초 · 첫 프레임으로 만든 결과예요(2026-11-14). 한국어는 \"카메라 고정\"을 지켰고, 영어는 카메라가 앞으로 다가갔어요. 한 번씩만 만든 거라 늘 이렇다는 뜻은 아니에요.",
              items: [
                { src: "assets/videos/wan_firstframe_ko.mp4", label: "한국어 프롬프트",
                  prompt: "여자가 천천히 횡단보도를 건너다 가운데서 멈춰 카메라를 본다. 차가운 공기에 입김이 하얗게 퍼진다. 카메라는 고정. 소리: 조용한 골목 소음과 눈 밟는 발소리. 대사 없음. 배경음악 없음." },
                { src: "assets/videos/wan_firstframe_en.mp4", label: "영어 프롬프트",
                  prompt: "The woman slowly walks across the crosswalk, stops in the middle and looks into the camera. Her breath fogs in the cold air. Fixed camera. Sound: quiet alley ambience and footsteps on the snow. No dialogue. No background music." },
              ],
            },
            { type: "vbuilder", id: "ff", mode: "firstframe", stateKey: VB_FF },
            { type: "videoupload", id: "ff", label: "첫 프레임 영상", res: "480p", dur: 5, promptFrom: VB_FF },
            {
              type: "tip",
              title: "기다리는 동안",
              text: "생성에는 몇 분 걸려요. 기다리는 동안 다음 스텝을 읽어 두세요. 다 되면 힉스필드에서 내려받아 위 칸에 올려요.",
            },
          ],
        },
        {
          id: "s5",
          tab: "참고 이미지",
          title: "참고 이미지로 새 장면 만들기",
          goal: "인물과 장소 사진을 참고 이미지로 넣고, 새 구도의 5초 영상을 만든다",
          minutes: 5,
          blocks: [
            {
              type: "guide",
              title: "사진을 \"재료\"로 넣고 장면은 새로 만들어요",
              items: [
                "힉스필드에서 <b>레퍼런스</b> 탭을 누르고, 첫 번째(Image 1)로 인물 샷, 두 번째(Image 2)로 장소 사진을 올려요. 순서가 중요해요.",
                "첫 프레임과 달리 <b>새 구도</b>로 만들어요. 그래서 샷 크기와 카메라를 프롬프트로 정할 수 있어요.",
                "프롬프트 첫머리에서 <b>역할을 정하고</b>(\"Image 1은 주인공이다\"), <b>얼굴을 고정하는 문장</b>을 넣어요.",
                "장소 사진은 사람이 없는 것이 좋아요. 사람이 있으면 두 번째 사람이 생길 수 있어서 빼기 목록에 \"extra people\"을 넣어요.",
              ],
            },
            { type: "vbuilder", id: "ref", mode: "reference", stateKey: VB_REF },
            { type: "videoupload", id: "ref", label: "참고 이미지 영상", res: "480p", dur: 5, promptFrom: VB_REF },
            {
              type: "check",
              id: "s5check",
              title: "보는 포인트",
              items: [
                "같은 사람으로 보인다 (1-2의 인물 유지 비교와 같은 기준)",
                "장소가 사진과 닮았다",
                "동작이 자연스럽고 하나로 끝난다",
              ],
              note: "첫 프레임 영상과 나란히 보면서, 어느 방식이 내 장면에 더 맞는지 골라 두세요.",
            },
          ],
        },
        {
          id: "s6",
          tab: "고치기",
          title: "한 군데만 고치기",
          goal: "두 영상 중 하나를 골라 문제 하나만 고친다",
          minutes: 3,
          blocks: [
            {
              type: "table",
              title: "문제가 보이면 이렇게 고쳐요",
              head: ["문제", "고치는 법"],
              rows: [
                ["얼굴이 바뀌었다", "얼굴 고정 문장을 앞으로 옮기고, 인물 특징을 다시 적어요"],
                ["동작이 엉킨다", "동작을 하나로 줄이거나 길이를 늘려요"],
                ["카메라가 이상하게 움직인다", "카메라 움직임을 하나만 남겨요"],
                ["자막, 글자, 워터마크가 생겼다", "끝에 빼기 목록을 넣어요"],
                ["원하지 않는 음악이나 말소리", "\"대사 없음. 배경음악 없음.\"을 넣어요"],
                ["너무 정적이다", "동사를 바꾸고 속도와 크기를 적어요 (slowly, sharply, a small step)"],
              ],
            },
            {
              type: "copychips",
              title: "자주 쓰는 고치기 문장 (눌러서 복사)",
              items: [
                { ko: "대사·배경음악 없음", koText: "대사 없음. 배경음악 없음.", en: "No dialogue. No background music." },
                { ko: "얼굴 고정", koText: "얼굴, 머리, 옷은 Image 1과 똑같이 유지한다.", en: "Keep the face, hair and outfit consistent with Image 1." },
                { ko: "빼기 목록", koText: "빼기 목록: 자막, 글자, 워터마크, 다른 사람.", en: "Negative prompt list: subtitles, text, watermark, extra people." },
                { ko: "동작을 천천히", koText: "천천히 부드럽게 움직인다.", en: "Slow, smooth movement." },
                { ko: "카메라 고정", koText: "카메라는 고정되어 있다.", en: "Fixed camera." },
              ],
            },
            {
              type: "guide",
              title: "고친 프롬프트로 다시 만들어요 (선택, 480p 5크레딧)",
              items: [
                "스텝 4나 5의 프롬프트 칸에서 <b>한 군데만</b> 고쳐요. 칩을 다시 누르면 문장이 새로 조립돼요.",
                "다시 만든 영상은 아래에 올려요. 시간이 없으면 넘어가도 괜찮아요.",
              ],
            },
            { type: "videoupload", id: "fix", label: "고친 영상", res: "480p", dur: 5 },
          ],
        },
        {
          id: "s7",
          tab: "최종",
          title: "마지막 한 편 만들기",
          goal: "고른 방식과 프롬프트로 720p 영상 한 편을 만든다",
          minutes: 4,
          blocks: [
            {
              type: "guide",
              title: "이번에는 화질을 올려요",
              items: [
                "설정을 <b>720p</b>로 바꿔요. 5초는 8.75크레딧, 10초는 17.5크레딧이에요.",
                "10초로 하려면 <b>동작을 두 개</b>로 늘려요. 아래에서 두 번째 동작을 고를 수 있어요.",
                "<b>생각하기</b>를 켜도 가격은 같아요. 느려지지만 마지막 한 편은 켜 볼 만해요.",
              ],
            },
            { type: "vbuilder", id: "final", mode: "final", stateKey: VB_FINAL, from: { firstframe: VB_FF, reference: VB_REF } },
            { type: "videoupload", id: "final", label: "내 첫 영상 (720p)", res: "720p", dur: 5, promptFrom: VB_FINAL },
          ],
        },
        {
          id: "s8",
          tab: "마무리",
          title: "내 첫 영상",
          goal: "영상과 프롬프트를 저장하고 오늘 쓴 크레딧을 확인한다",
          minutes: 2,
          blocks: [
            { type: "vfinal", order: ["final", "fix", "ref", "ff"] },
            {
              type: "check",
              id: "finalcheck",
              title: "마무리 체크",
              items: [
                "첫 프레임과 참고 이미지 방식의 차이를 안다",
                "프롬프트에 동작, 카메라, 소리를 나눠 썼다",
                "원하지 않는 소리와 글자를 빼는 문장을 안다",
                "720p 영상 한 편을 내려받았다",
                "이 페이지에 영상과 프롬프트를 올렸다",
              ],
              note: "다음 유닛(1-4 캐릭터 시트와 스틸컷)에서는, 오늘 얼굴이 흔들렸다면 그걸 잡는 방법을 배워요.",
            },
          ],
        },
      ],
    },
    { id: "u4", code: "1-4", title: "캐릭터 시트와 스틸컷", locked: true },
    { id: "u5", code: "1-5", title: "힉스필드 모델 비교", locked: true },
  ],
};

export const MODELS = [
  // notes are facts only (unit 1-2 lets participants judge quality themselves)
  { id: "seedream_5_5", name: "Seedream 5.5", maker: "ByteDance", note: "최대 2K · 참고 이미지 10장" },
  { id: "gpt_image_2_6", name: "GPT Image 2.6", maker: "OpenAI", note: "최대 4K · 참고 이미지 16장" },
  { id: "nano_banana_2_1", name: "Nano Banana 2.1", maker: "Google", note: "최대 4K · 참고 이미지 14장" },
];
