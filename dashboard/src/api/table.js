import request from '@/utils/request'

export function getList(params) {
  return request({
    url: '/payments',
    method: 'get',
    params
  })
}
