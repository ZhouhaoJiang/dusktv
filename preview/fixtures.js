// Public poster references are preview fixtures only. Production reads the configured server.
export const movies = [
  { id: 'dune', title: '沙丘 2', year: '2024', tag: '科幻', poster: 'https://cdn.mos.cms.futurecdn.net/vzo4SpJYAVBaimKgsRw7vA.jpg' },
  { id: 'interstellar', title: '星际穿越', year: '2014', tag: '科幻', poster: 'https://cdn.ome.lt/legacy/images/galerias/Interstellar/Interstellar-Poster-18Set2014-1.jpg' },
  { id: 'spirited', title: '千与千寻', year: '2001', tag: '动画', poster: 'https://image13.m1905.cn/mdb/uploadfile/2019/0524/20190524013700133933.jpg' },
  { id: 'love', title: '花样年华', year: '2000', tag: '经典', poster: 'https://img1.bjd.com.cn/2025/02/14/9330ef4b850ad53f6a0ad96bf8f35f24cd07f295.jpg' },
  { id: 'blade', title: '银翼杀手 2049', year: '2017', tag: '科幻', poster: 'https://www.originalfilmart.com/cdn/shop/products/blade_runner_2049_2017_advance_original_film_art_efd5b98a-e898-4999-810d-1a0448114ff4.jpg?v=1640043899&width=1200' },
  { id: 'hotel', title: '布达佩斯大饭店', year: '2014', tag: '经典', poster: 'https://cdn.shopify.com/s/files/1/1416/8662/products/1_aba3b3f6-35c4-4f40-ac16-feb6bf4aac28_spo_2000x.jpg?v=1562540105' },
].map(item => ({ ...item, source: 'preview' }));
export const categories = [
  { title: '最近播放', type: 'record' },
  { title: '热门剧集', type: 'tv', tag: '热门' },
  { title: '电视剧', type: 'tv', tags: ['国产剧', '美剧', '英剧', '韩剧', '日剧'] },
  { title: '电影', type: 'movie', tags: ['热门', '经典', '科幻', '动画'] },
  { title: '综艺', type: 'tv', tag: '综艺' },
  { title: '豆瓣 Top250', type: 'movie', tag: 'top250' },
];
