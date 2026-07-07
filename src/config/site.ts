/**
 * KBBook 站点配置
 *
 * 所有品牌相关字符串统一从此文件读取。
 * 用户可通过修改此文件或设置环境变量覆盖默认值。
 */

export interface SiteConfig {
  /** 站点名称，显示在 Header / Footer / Breadcrumb / 页面 title */
  name: string
  /** 短名称，用于空间有限的场景（如 Header logo 旁） */
  shortName: string
  /** 一句话描述，显示在首页 Hero */
  tagline: string
  /** 详细描述（meta description） */
  description: string
  /** 页脚 copyright 文本，{year} 会被替换为当前年份 */
  footer: string
  /** GitHub 仓库 URL */
  githubUrl: string
  /** Header logo 配置 */
  logo: {
    /** Logo 方框中的文字（1-2 字符） */
    text: string
  }
}

export const siteConfig: SiteConfig = {
  name: import.meta.env.VITE_SITE_NAME || 'KBBook',
  shortName: import.meta.env.VITE_SITE_SHORT_NAME || 'KBBook',
  tagline: import.meta.env.VITE_SITE_TAGLINE || 'Your Knowledge Base, in Book Form',
  description: import.meta.env.VITE_SITE_DESCRIPTION || 'A multi-series documentation portal powered by Markdown',
  footer: import.meta.env.VITE_SITE_FOOTER || 'Powered by KBBook',
  githubUrl: import.meta.env.VITE_GITHUB_URL || 'https://github.com/KOMKZ/kbbook',
  logo: {
    text: import.meta.env.VITE_LOGO_TEXT || 'KB',
  },
}
