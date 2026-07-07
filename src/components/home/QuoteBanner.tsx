import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Fade from '@mui/material/Fade'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

interface Quote {
  text: string
  source?: string
}

// 50 句滚动文案 —— 文言只留 10%(5 句),其余白话/现代/经典台词/工程师箴言
const QUOTES: Quote[] = [
  // ===== 文言(5 句,约 10%) =====
  { text: '学而不思则罔,思而不学则殆。', source: '《论语》' },
  { text: '千里之行,始于足下。', source: '《老子》' },
  { text: '三人行,必有我师焉。', source: '《论语》' },
  { text: '纸上得来终觉浅,绝知此事要躬行。', source: '陆游' },
  { text: '路漫漫其修远兮,吾将上下而求索。', source: '屈原' },

  // ===== 中文白话 / 现代名言 / 通俗箴言 =====
  { text: '求知若饥,虚心若愚。', source: '乔布斯' },
  { text: '永远相信美好的事情即将发生。', source: '罗永浩' },
  { text: '怕什么真理无穷,进一寸有一寸的欢喜。', source: '胡适' },
  { text: '种一棵树最好的时间是十年前,其次是现在。', source: '谚语' },
  { text: '热爱可抵岁月漫长。' },
  { text: '比你优秀的人都还在努力,你又有什么资格不努力。' },
  { text: '把简单的事做到极致,就是不简单。' },
  { text: '真正的精通,是把复杂讲成简单。' },
  { text: '想清楚,才能写清楚。' },
  { text: '错误是最好的老师。' },
  { text: '慢就是快。' },
  { text: '把好奇心当成燃料。' },
  { text: '一个人最大的对手,永远是自己。' },
  { text: '重复一万次,直到肌肉记忆。' },
  { text: '学习是把别人的经验变成自己的本能。' },
  { text: '你只管努力,时间会回答你。' },
  { text: '你以为努力是为了见到更厉害的人,其实是为了成为更好的自己。' },
  { text: '我们终其一生,就是要摆脱他人的期待,找到真正的自己。', source: '《无声告白》' },
  { text: '把每一次卡壳,写成一段可推导的旅程。' },
  { text: '第一性原理,优于诉诸权威。' },
  { text: '不要在该奋斗的年纪选择安逸。' },
  { text: '所有的牛逼,背后都是苦逼;所有的苦逼,背后都是傻逼。', source: '网络箴言' },
  { text: '你的努力终将以另一种方式归来。' },
  { text: '学习的尽头,是把复杂讲成简单。' },

  // ===== 中译名人名言 / 工程师箴言 / 经典影视台词 =====
  { text: '废话少说,放码过来。', source: 'Linus Torvalds' },
  { text: '过早的优化是万恶之源。', source: '高德纳' },
  { text: '程序首先是写给人看的,顺便才让机器执行。', source: 'Abelson《SICP》' },
  { text: '简洁,是终极的精致。', source: '达·芬奇' },
  { text: '预测未来最好的方式,就是创造它。', source: 'Alan Kay' },
  { text: '先让它跑起来,再让它正确,最后让它快。', source: 'Kent Beck' },
  { text: '计算机科学里只有两件难事:缓存失效和命名。', source: 'Phil Karlton' },
  { text: '任何领域的专家,都曾是新手。', source: 'Helen Hayes' },
  { text: '我们由重复做的事情塑造,卓越于是一种习惯。', source: '亚里士多德' },
  { text: '知道还不够,必须付诸实践;愿意还不够,必须付诸行动。', source: '李小龙' },
  { text: '完成比完美更重要。', source: '桑德伯格' },
  { text: '想象力比知识更重要。', source: '爱因斯坦' },
  { text: '如果说我看得更远,那是因为我站在巨人的肩膀上。', source: '牛顿' },
  { text: '天才是百分之一的灵感,加上百分之九十九的汗水。', source: '爱迪生' },
  { text: '要么忙着活,要么忙着死。', source: '《肖申克的救赎》' },
  { text: '昨天是历史,明天是谜团,今天是礼物。', source: '《功夫熊猫》' },
  { text: '我们能决定的,只是如何度过这被赋予我们的时光。', source: '甘道夫·《魔戒》' },
  { text: '继续游就对了。', source: '多莉·《海底总动员》' },
  { text: '把握当下,孩子们。', source: '《死亡诗社》' },
  { text: '能力越大,责任越大。', source: '《蜘蛛侠》' },
  { text: '定义我的,不是我内在是什么,而是我做了什么。', source: '《蝙蝠侠:侠影之谜》' },
]

const INTERVAL_MS = 5000
const FADE_MS = 400

/**
 * 首页顶部励志名言滚动 banner —— 3s 切一句,淡入淡出。
 */
const QuoteBanner = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [show, setShow] = useState(true)

  useEffect(() => {
    const tick = setInterval(() => {
      // 先淡出,再换内容,再淡入
      setShow(false)
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % QUOTES.length)
        setShow(true)
      }, FADE_MS)
    }, INTERVAL_MS)
    return () => clearInterval(tick)
  }, [])

  const q = QUOTES[idx]

  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: isDark ? 'rgba(80,70,229,0.08)' : 'rgba(80,70,229,0.04)',
        borderBottom: 1,
        borderColor: 'divider',
        py: { xs: 0.5, md: 1 },
      }}
    >
      <Container maxWidth="lg">
        <Fade in={show} timeout={FADE_MS}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 1.25,
              justifyContent: 'center',
              flexWrap: 'wrap',
              fontFamily: '"Source Han Serif","Noto Serif SC","Songti SC",serif',
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: '0.85rem', md: '0.95rem' },
                color: 'text.primary',
                fontStyle: 'italic',
                letterSpacing: 0.3,
                lineHeight: 1.7,
              }}
            >
              「{q.text}」
            </Typography>
            {q.source && (
              <Typography
                sx={{
                  fontSize: { xs: '0.72rem', md: '0.78rem' },
                  color: 'text.secondary',
                  fontStyle: 'normal',
                }}
              >
                —— {q.source}
              </Typography>
            )}
          </Box>
        </Fade>
      </Container>
    </Box>
  )
}

export default QuoteBanner
