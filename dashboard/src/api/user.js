import request from '@/utils/request'

export function login(data) {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

export function getInfo(token) {
  return request({
    url: '/auth/info',
    method: 'get',
    headers: { authorization: token }
  })
}

export function logout() {
  return request({
    url: '/user/logout',
    method: 'post'
  })
}
