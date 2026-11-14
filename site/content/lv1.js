// Lv.1 study content. Pure data: the renderer in js/app.js turns each block `type` into UI.
// Block types: lead, make, flow, guide, anatomy, tip, generator, ab, check, pick (see README.md).

// Person and place examples come in pairs (`pair` = place `key`): each person belongs naturally in one of the
// four places, and step 3 recommends the place that matches the person picked in step 2.
const PERSON_EXAMPLES = [
  {
    label: "20대 · 트렌치코트",
    pair: "street",
    pairLabel: "길거리",
    prompt: "20대 초반 한국 여성. 검은 단발머리에 가벼운 앞머리. 베이지 트렌치코트, 흰 니트, 연청 바지, 흰 운동화, 어깨에 작은 갈색 가방. 카메라를 보며 살짝 웃는 표정. 머리부터 발끝까지 보이는 전신, 정면에 가까운 자세. 밝은 회색 무지 배경. 부드러운 자연광, 실사 사진.",
  },
  {
    label: "20대 · 숲속 여행자",
    pair: "forest",
    pairLabel: "숲",
    prompt: "20대 후반 한국 남성 여행자. 덥수룩한 검은 머리와 짧은 수염. 모자가 달린 카키색 롱코트, 두툼한 니트 목도리, 낡은 갈색 가죽 부츠. 등에 큰 배낭을 메고 한 손에 작은 랜턴을 들었다. 호기심 어린 표정. 머리부터 발끝까지 보이는 전신, 정면. 연한 회색 무지 배경. 부드러운 조명, 실사 사진.",
  },
  {
    label: "20대 · K-pop 아이돌",
    pair: "kpop",
    pairLabel: "K-pop 세트",
    prompt: "20대 초반 한국 여성, K-pop 아이돌 스타일. 은색으로 염색한 긴 생머리. 반짝이는 은색 크롭 재킷, 검은 와이드 팬츠, 굵은 체인 목걸이, 두꺼운 밑창의 흰 부츠. 자신감 있는 눈빛으로 카메라를 본다. 머리부터 발끝까지 보이는 전신, 정면. 검은색 무지 배경. 깔끔한 스튜디오 조명, 실사 사진.",
  },
  {
    label: "30대 · 회사원",
    pair: "office",
    pairLabel: "오피스",
    prompt: "30대 한국 남성 회사원. 단정하게 넘긴 짧은 머리. 하늘색 셔츠에 남색 니트 조끼, 회색 슬랙스, 목에 건 사원증, 한 손에 텀블러. 조금 피곤하지만 친근한 미소. 머리부터 발끝까지 보이는 전신, 정면. 밝은 회색 무지 배경. 부드러운 사무실 조명, 실사 사진.",
  },
];

const PLACE_EXAMPLES = [
  {
    key: "street",
    label: "한국의 길거리",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 서울의 좁은 상점가 골목에서 횡단보도를 건너는 장면. 양옆에 한글 간판이 달린 가게들, 머리 위로 얽힌 전깃줄, 회색 보도블록. 인물은 화면 가운데 전신, 눈높이 카메라. 실사 사진.",
  },
  {
    key: "forest",
    label: "신비로운 숲",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 안개가 깔린 깊은 숲, 이끼 낀 거대한 나무 사이 오솔길을 걸으며 위를 올려다보는 장면. 나뭇잎 사이로 빛줄기가 내려온다. 전신, 조금 낮은 곳에서 올려다보는 카메라. 실사 사진.",
  },
  {
    key: "kpop",
    label: "K-pop 뮤비 세트",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 실내 K-pop 뮤직비디오 세트. 반짝이는 검은 바닥, 벽을 따라 이어진 네온 라인 조명, 바닥에 깔린 옅은 연기. 인물이 세트 한가운데에서 안무 동작의 한 순간처럼 포즈를 잡는다. 전신, 정면 와이드. 실사 사진.",
  },
  {
    key: "office",
    label: "오피스 자리",
    prompt: "첨부한 이미지의 인물을 그대로 둔다(얼굴, 머리, 옷이 같아야 한다). 창가 사무실 책상에 앉아 노트북을 보다가 고개를 든 순간. 책상 위에 모니터, 서류 더미, 머그컵. 뒤로 다른 책상들이 흐릿하게 보인다. 허리 위가 보이는 미디엄 샷. 실사 사진.",
  },
];

const SAME_SCENE = "첨부한 이미지와 같은 장면이다. 인물의 얼굴·머리·옷, 장소, 구도는 그대로 둔다.";

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
                { label: "옷 · 소품", text: "베이지 트렌치코트, 흰 운동화, 작은 가방", color: "c" },
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
                "장소는 <b>눈에 보이는 물건 세 가지</b> 이상으로 묘사해요. 예: 한글 간판, 전깃줄, 보도블록.",
              ],
            },
            {
              type: "anatomy",
              title: "장소 프롬프트의 뼈대",
              parts: [
                { label: "인물 유지", text: "첨부한 인물을 그대로 둔다", color: "a" },
                { label: "어디서 · 무엇을", text: "상점가 골목에서 횡단보도를 건넌다", color: "b" },
                { label: "보이는 물건", text: "한글 간판, 전깃줄, 보도블록", color: "c" },
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
    { id: "u2", code: "1-2", title: "이미지 모델 비교하기", locked: true },
    { id: "u3", code: "1-3", title: "이미지 프롬프트 다듬기", locked: true },
    { id: "u4", code: "1-4", title: "힉스필드로 첫 영상", locked: true },
    { id: "u5", code: "1-5", title: "캐릭터 시트와 스틸컷", locked: true },
    { id: "u6", code: "1-6", title: "힉스필드 모델 비교", locked: true },
    { id: "u7", code: "1-7", title: "영상 프롬프트 다듬기", locked: true },
  ],
};

export const MODELS = [
  { id: "seedream_5_5", name: "Seedream 5.5", maker: "ByteDance", note: "사진 같은 질감, 생성과 편집" },
  { id: "gpt_image_2_6", name: "GPT Image 2.6", maker: "OpenAI", note: "긴 지시를 잘 따름, 생성과 편집" },
  { id: "nano_banana_2_1", name: "Nano Banana 2.1", maker: "Google", note: "참고 이미지를 잘 활용, 생성과 편집" },
];
