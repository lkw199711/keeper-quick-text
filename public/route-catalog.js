// 路由维护入口：仓库 → 业务模块 → 页面路由。
// Repository: id, name, description, environments, modules
// environments: 按部署环境维护该仓库的默认 IP 与域名。
// Module:     id, name, description, routes
// Route:      id, name, type('audit' | 'query'), path
// path 仅包含域名后的路径和查询参数，生成时会与用户填写的域名组合。
export const DEPLOYMENT_ENVIRONMENTS = [
  { id: 'test', name: '测试环境', shortName: '测试', description: '日常联调与功能验证', isDefault: true },
  { id: 'staging', name: '预发环境', shortName: '预发', description: '上线前的预发布验证' },
  { id: 'production', name: '线上环境', shortName: '线上', description: '正式生产环境' }
];

export const DEFAULT_DEPLOYMENT_ENVIRONMENT_ID = 'test';

export const REPOSITORY_CATALOG = [
  {
    id: 'keeper-sell-supplier',
    name: 'keeper-sell-supplier',
    description: '自营 / POP 入驻、资质与单品审核',
    environments: {
      test: { ip: '6.120.39.72', domain: 'sell-supplier.jdtest.net' },
      staging: { ip: '6.120.39.72', domain: 'seller-v10.shop.jd.com' },
      production: { ip: '11.125.76.107', domain: 'man-keeper.jd.com' }
    },
    modules: [
      {
        id: 'self-operated-onboarding',
        name: '自营入驻',
        description: '自营供应商入驻审核与查询',
        routes: [
          { id: 'audit', name: '自营入驻审核', type: 'audit', path: '/keeper/seller-supplier/supplier-manage' },
          { id: 'query', name: '自营入驻查询', type: 'query', path: '/keeper/seller-supplier/all-settle-audit' }
        ]
      },
      {
        id: 'self-operated-basic-qualification',
        name: '自营基本资质',
        description: '自营基本资质审核与查询',
        routes: [
          { id: 'audit', name: '自营基本资质审核', type: 'audit', path: '/keeper/seller-supplier/basicinfo?page=true&tabName=basic_qua_audit' },
          { id: 'query', name: '自营基本资质查询', type: 'query', path: '/keeper/seller-supplier/basicinfo?page=true&tabName=basic_qua_view' }
        ]
      },
      {
        id: 'self-operated-product-line',
        name: '自营产品线',
        description: '自营产品线审核与查询',
        routes: [
          { id: 'audit', name: '自营产品线审核', type: 'audit', path: '/keeper/seller-supplier/productline?page=true&tabName=product_line_audit' },
          { id: 'query', name: '自营产品线查询', type: 'query', path: '/keeper/seller-supplier/productline?page=true&tabName=product_line_view' }
        ]
      },
      {
        id: 'self-operated-sku',
        name: '自营单品',
        description: '自营单品资质审核与查询',
        routes: [
          { id: 'audit', name: '自营单品审核', type: 'audit', path: '/keeper/seller-supplier/skuQualificaion?page=true&tabName=sku_qua_audit' },
          { id: 'query', name: '自营单品查询', type: 'query', path: '/keeper/seller-supplier/skuQualificaion?page=true&tabName=sku_qua_view' }
        ]
      },
      {
        id: 'pop-onboarding',
        name: 'POP 入驻',
        description: 'POP 商家入驻审核与查询',
        routes: [
          { id: 'audit', name: 'pop入驻审核', type: 'audit', path: '/keeper/seller-supplier/mySettledCredential' },
          { id: 'query', name: 'pop入驻查询', type: 'query', path: '/keeper/seller-supplier/settledQuery' }
        ]
      }
    ]
  },
  {
    id: 'keeper-qua-audit',
    name: 'keeper-qua-audit',
    description: 'POP 品牌与类目、供应商黄标审核',
    environments: {
      test: { ip: '6.120.39.72', domain: 'qua-audit.jdtest.net' },
      staging: { ip: '6.120.39.72', domain: 'seller-v10.shop.jd.com' },
      production: { ip: '11.125.76.107', domain: 'man-keeper.jd.com' }
    },
    modules: [
      {
        id: 'pop-brand',
        name: 'POP 品牌',
        description: 'POP 品牌审核与查询',
        routes: [
          { id: 'audit', name: 'pop品牌审核', type: 'audit', path: '/keeper/qua-audit/brandAudit' },
          { id: 'query', name: 'pop品牌查询', type: 'query', path: '/keeper/qua-audit/brandQuery' }
        ]
      },
      {
        id: 'pop-category',
        name: 'POP 类目',
        description: 'POP 类目审核与查询',
        routes: [
          { id: 'audit', name: 'pop类目审核', type: 'audit', path: '/keeper/qua-audit/categoryAudit' },
          { id: 'query', name: 'pop类目查询', type: 'query', path: '/keeper/qua-audit/categoryQuery' }
        ]
      },
      {
        id: 'supplier-tag',
        name: '供应商黄标',
        description: '供应商黄标审核与查询',
        routes: [
          { id: 'audit', name: '供应商黄标审核', type: 'audit', path: '/keeper/qua-audit/supplierTagAudit' },
          { id: 'query', name: '供应商黄标查询', type: 'query', path: '/keeper/qua-audit/supplierTagQuery' }
        ]
      }
    ]
  },
  {
    id: 'keeper-second-review',
    name: 'keeper-second-review',
    description: '门店、商家、视频与装修审核',
    environments: {
      test: { ip: '6.120.39.72', domain: 'second-review.jdtest.net' },
      staging: { ip: '6.120.39.72', domain: 'seller-v10.shop.jd.com' },
      production: { ip: '11.125.76.107', domain: 'man-keeper.jd.com' }
    },
    modules: [
      {
        id: 'store-qualification',
        name: '门店资质',
        description: '门店资质审核与查询',
        routes: [
          { id: 'audit', name: '门店资质审核', type: 'audit', path: '/keeper/takeout/storeQuaAudit' },
          { id: 'query', name: '门店资质查询', type: 'query', path: '/keeper/takeout/storeAuditQuery' }
        ]
      },
      {
        id: 'merchant-qualification',
        name: '商家资质',
        description: '商家资质审核与查询',
        routes: [
          { id: 'audit', name: '商家资质审核', type: 'audit', path: '/keeper/takeout/shopQuaAudit' },
          { id: 'query', name: '商家资质查询', type: 'query', path: '/keeper/takeout/shopAuditQuery' }
        ]
      },
      {
        id: 'lbs-video',
        name: 'LBS 视频',
        description: 'LBS 视频审核',
        routes: [
          { id: 'audit', name: 'lbs视频审核', type: 'audit', path: '/keeper/takeout/storeVideoAudit' }
        ]
      },
      {
        id: 'store-renovation',
        name: '门店装修',
        description: '门店装修审核与查询',
        routes: [
          { id: 'audit', name: '门店装修审核', type: 'audit', path: '/keeper/takeout/renovation' },
          { id: 'query', name: '门店装修查询', type: 'query', path: '/keeper/takeout/renovationQuery' }
        ]
      }
    ]
  }
];

export function findRepository(repositoryId) {
  return REPOSITORY_CATALOG.find((repository) => repository.id === repositoryId);
}

export function findDeploymentEnvironment(environmentId) {
  return DEPLOYMENT_ENVIRONMENTS.find((environment) => environment.id === environmentId);
}

export function getRepositoryEnvironmentAddress(repository, environmentId = DEFAULT_DEPLOYMENT_ENVIRONMENT_ID) {
  return repository?.environments?.[environmentId];
}

export function getRepositoryRouteCount(repository) {
  return repository.modules.reduce((total, module) => total + module.routes.length, 0);
}
