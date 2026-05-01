export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

export const authInstitutions = [
  {
    name: "中国传媒大学海南国际学院",
    tags: ["中国传媒大学", "高校认证"],
    domains: ["coventry.ac.uk", "cuc.cn", "cuc.edu.cn"]
  },
  {
    name: "中央民族大学海南国际学院",
    tags: ["中央民族大学", "高校认证"],
    domains: ["live.mdx.ac.uk", "mdx.ac.uk", "muc.cn", "muc.edu.cn"]
  },
  {
    name: "北京体育大学阿尔伯塔国际休闲体育与旅游学院",
    tags: ["北京体育大学", "高校认证"],
    domains: ["bsu.cn", "bsu.edu.cn", "ualberta.ca"]
  },
  {
    name: "北京语言大学",
    tags: ["北京语言大学", "高校认证"],
    domains: ["blcu.cn", "blcu.edu.cn"]
  },
  {
    name: "北京邮电大学玛丽女王海南学院",
    tags: ["北京邮电大学", "高校认证"],
    domains: ["bupt.cn", "bupt.edu.cn", "qmul.ac.uk"]
  },
  {
    name: "电子科技大学格拉斯哥海南学院",
    tags: ["电子科技大学", "高校认证"],
    domains: ["gla.ac.uk", "glasgow.ac.uk", "uestc.cn", "uestc.edu.cn"]
  }
];

export const mapItems = [
  { id: "teaching", title: "公共教学楼", type: "place", lat: 18.400032, lng: 110.016989 },
  { id: "lab", title: "公共实验楼", type: "place", lat: 18.401458, lng: 110.018094 },
  { id: "canteen-1", title: "一号食堂", type: "food", lat: 18.401799, lng: 110.020122 },
  { id: "library", title: "图书馆", type: "study", lat: 18.403036, lng: 110.014774 },
  { id: "gym", title: "综合体育馆", type: "sport", lat: 18.404374, lng: 110.02143 },
  { id: "dorm-1", title: "生活一区", type: "life", lat: 18.395955, lng: 110.016671 },
  { id: "dorm-2", title: "生活二区", type: "life", lat: 18.397625, lng: 110.018474 },
  { id: "hall", title: "学生会堂", type: "place", lat: 18.39596, lng: 110.014161 },
  { id: "bsu", title: "北京体育大学专享楼", type: "school", lat: 18.403964, lng: 110.018973 },
  { id: "cuc", title: "中国传媒大学专享楼", type: "school", lat: 18.399433, lng: 110.013919 }
];
