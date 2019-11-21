import request from '@/utils/request'

export function getBalance(params) {
  return request({
    url: '/account/getBalance',
    method: 'get',
    params
  })
}

