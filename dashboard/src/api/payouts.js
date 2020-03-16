import request from '@/utils/request'

export function sendPayoutBundle(params) {
  return request({
    url: '/payouts',
    method: 'post',
    params
  })
}

export function getPayouts(params) {
  return request({
    url: '/payouts',
    method: 'get',
    params
  })
}

export function getPayout(id) {
  return request({
    url: '/payouts/' + id,
    method: 'get'
  })
}
