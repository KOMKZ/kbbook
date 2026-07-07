/**
 * 系列(Series)模型 —— 多系列学习门户的顶层组织单位。
 * 一个系列对应一组主题(theme/group)+ 一组文章,有自己的着陆页和路线图。
 */

export interface Series {
  id: string
  title: string
  shortTitle?: string
  tagline?: string
  description?: string
  version?: string
  language?: string
  color?: string
  icon?: string
  enabled: boolean
}

export interface SeriesRegistry {
  defaultSeries: string
  series: Series[]
}
