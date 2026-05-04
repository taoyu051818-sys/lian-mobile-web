const state = {
  feed: {
    tab: "此刻",
    page: 1,
    loading: false,
    preloading: false,
    hasMore: true,
    status: "idle",
    requestId: 0,
    readHistory: JSON.parse(localStorage.getItem("lian.readHistory") || "[]"),
    pullStartY: null,
    pullActive: false,
    scrollY: 0,
    masonryHeights: [0, 0],
    revealIndex: 0
  },
  map: {
    ready: false,
    routeFrame: null,
    routeStartedAt: 0,
    transform: null,
    drag: null,
    lastDragAt: 0,
    routeFilter: "all",
    routesVisible: true,
    showPlaces: true,
    showMemories: true,
    showFoodMenus: true,
    pickingLocation: false,
    pickedPoint: null
  },
  channel: {
    loading: false,
    offset: 0,
    hasMore: true,
    loadedIds: new Set()
  },
  auth: {
    mode: "login",
    currentUser: null
  },
  aiPublish: {
    active: false,
    step: "upload",
    imageUrl: "",
    aiMode: "",
    confidence: 0,
    needsHumanReview: false,
    riskFlags: [],
    metadata: {},
    locationDraft: null,
    previewLoading: false,
    uploadLoading: false,
    draftSaving: false,
    draftSaveStatus: "",
    draftId: ""
  },
  publish: {
    active: false,
    step: "imageSelect",
    imageUrls: [],
    localImageUrls: [],
    selectedFiles: [],
    uploadPromise: null,
    uploadProgress: {},
    locationDraft: null,
    title: "",
    body: "",
    tags: [],
    metadata: {},
    audience: null,
    userEditedAudience: false,
    riskFlags: [],
    confidence: 0,
    needsHumanReview: false,
    aiMode: "",
    previewLoading: false,
    uploadLoading: false,
    draftSaving: false,
    draftSaveStatus: "",
    draftId: ""
  },
  initialized: false,
  previousView: "feed",
  avatarCrop: null
};

const stateAliases = {
  tab: ["feed", "tab"],
  page: ["feed", "page"],
  loading: ["feed", "loading"],
  preloading: ["feed", "preloading"],
  hasMore: ["feed", "hasMore"],
  readHistory: ["feed", "readHistory"],
  pullStartY: ["feed", "pullStartY"],
  pullActive: ["feed", "pullActive"],
  feedScrollY: ["feed", "scrollY"],
  masonryHeights: ["feed", "masonryHeights"],
  mapReady: ["map", "ready"],
  routeFrame: ["map", "routeFrame"],
  routeStartedAt: ["map", "routeStartedAt"],
  mapTransform: ["map", "transform"],
  mapDrag: ["map", "drag"],
  lastMapDragAt: ["map", "lastDragAt"],
  mapRouteFilter: ["map", "routeFilter"],
  mapRoutesVisible: ["map", "routesVisible"],
  mapShowPlaces: ["map", "showPlaces"],
  mapShowMemories: ["map", "showMemories"],
  mapShowFoodMenus: ["map", "showFoodMenus"],
  mapPickingLocation: ["map", "pickingLocation"],
  mapPickedPoint: ["map", "pickedPoint"],
  channelLoading: ["channel", "loading"],
  channelOffset: ["channel", "offset"],
  channelHasMore: ["channel", "hasMore"],
  channelLoadedIds: ["channel", "loadedIds"],
  authMode: ["auth", "mode"],
  currentUser: ["auth", "currentUser"]
};

Object.defineProperties(state, Object.fromEntries(Object.entries(stateAliases).map(([key, [group, field]]) => [
  key,
  {
    get: () => state[group][field],
    set: (value) => {
      state[group][field] = value;
    }
  }
])));const MAP_INITIAL_Y_OFFSET = 32;

const campusMap = {
  width: 1448,
  height: 1086,
  vehicle: "/assets/shuttle-cart.png",
  routes: [
    {
      id: "bf652947-de73-4181-89b6-f6fbcd98b2ef",
      title: "二号线",
      color: "#2f80ed",
      points: [
        { x: 148, y: 766 }, { x: 301, y: 677 }, { x: 487, y: 552 },
        { x: 577, y: 504 }, { x: 692, y: 576 }, { x: 770, y: 515 },
        { x: 856, y: 421 }, { x: 921, y: 284 }, { x: 965, y: 220 },
        { x: 993, y: 171 }, { x: 868, y: 126 }, { x: 819, y: 160 },
        { x: 738, y: 305 }, { x: 693, y: 374 }, { x: 471, y: 551 },
        { x: 286, y: 674 }, { x: 148, y: 766 }
      ]
    },
    {
      id: "f4806fbc-a6fb-49e1-bf46-74969baa67d9",
      title: "一号线",
      color: "#dc3b38",
      points: [
        { x: 577, y: 807 }, { x: 668, y: 737 }, { x: 727, y: 802 },
        { x: 663, y: 735 }, { x: 757, y: 637 }, { x: 824, y: 703 },
        { x: 757, y: 635 }, { x: 981, y: 407 }, { x: 994, y: 370 },
        { x: 894, y: 320 }, { x: 920, y: 285 }, { x: 958, y: 234 },
        { x: 988, y: 170 }, { x: 1095, y: 215 }, { x: 985, y: 165 },
        { x: 847, y: 431 }, { x: 755, y: 517 }, { x: 674, y: 582 },
        { x: 574, y: 662 }, { x: 639, y: 705 }, { x: 668, y: 739 },
        { x: 577, y: 808 }
      ]
    },
    {
      id: "1402831c-b64f-4f15-8109-23f2c62c8572",
      title: "教师专线",
      color: "#59ed31",
      points: [
        { x: 869, y: 718 }, { x: 852, y: 725 }, { x: 645, y: 552 },
        { x: 696, y: 576 }, { x: 767, y: 507 }, { x: 844, y: 431 },
        { x: 843, y: 446 }, { x: 770, y: 516 }, { x: 695, y: 582 },
        { x: 649, y: 550 }, { x: 857, y: 729 }, { x: 875, y: 719 }
      ]
    }
  ]
};

const campusPlaces = [
  { label: "图书馆", x: 629, y: 325 },
  { label: "中央民族大学", x: 807, y: 325 },
  { label: "北京体育大学", x: 870, y: 246 },
  { label: "综合体育中心", x: 1000, y: 270 },
  { label: "大墩村", x: 1206, y: 337 },
  { label: "公共实验楼", x: 843, y: 431 },
  { label: "公共教学楼", x: 744, y: 491 },
  { label: "气膜馆", x: 635, y: 484 },
  { label: "滨海体育场", x: 501, y: 444 },
  { label: "中国传媒大学", x: 573, y: 567 },
  { label: "一号食堂", x: 930, y: 430 },
  { label: "生活二区", x: 869, y: 620 },
  { label: "生活一区", x: 761, y: 716 },
  { label: "学生会堂", x: 592, y: 713 },
  { label: "教师公寓", x: 927, y: 742 },
  { label: "消防站", x: 1029, y: 666 },
  { label: "劳动基地农田", x: 764, y: 910 },
  { label: "国电投", x: 1129, y: 522 },
  { label: "创新创业中心", x: 521, y: 770 },
  { label: "北京邮电大学", x: 330, y: 724 },
  { label: "电子科技大学", x: 203, y: 819 }
];

const campusMapPosts = [
  {
    tid: 99,
    kind: "food",
    title: "贝可Bakell轻食店菜单",
    body: "大墩村民主大道四横巷11号",
    placeName: "大墩村",
    x: 1206,
    y: 337,
    imageUrl: "https://res.cloudinary.com/dhvyvfu4n/image/upload/f_auto,q_auto,c_limit,w_900/v1777366344/nodebb-frontend/menu-covers/ejqsdbg25kcruwotkeba.png"
  },
  {
    tid: 100,
    kind: "memory",
    title: "中传楼上看到的晚霞",
    body: "2026年4月15日 19:14",
    placeName: "中国传媒大学专享楼",
    x: 573,
    y: 548,
    imageUrl: "https://res.cloudinary.com/dhvyvfu4n/image/upload/f_auto,q_auto,c_fill,w_360,h_260/v1777446554/nodebb-frontend/mobile-web-upload/lp1l2knbyazsod3ikykj.jpg"
  }
];

const geoImagePairs = [
  { lat: 18.399433, lng: 110.013919, x: 573, y: 567 },
  { lat: 18.400032, lng: 110.016989, x: 744, y: 491 },
  { lat: 18.401458, lng: 110.018094, x: 843, y: 431 },
  { lat: 18.403036, lng: 110.014774, x: 629, y: 325 },
  { lat: 18.395955, lng: 110.016671, x: 761, y: 716 },
  { lat: 18.397625, lng: 110.018474, x: 869, y: 620 },
  { lat: 18.395424, lng: 110.01275, x: 521, y: 770 },
  { lat: 18.395598, lng: 110.009517, x: 330, y: 724 },
  { lat: 18.394325, lng: 110.007274, x: 203, y: 819 }
];
