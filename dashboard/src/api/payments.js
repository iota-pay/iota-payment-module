import request from '@/utils/request'

export function getPayments(params) {
  return request({
    url: '/payments',
    method: 'get',
    params
  })
}
export function getPayment(id) {
  return request({
    url: '/payments/' + id,
    method: 'get'
  })
}

