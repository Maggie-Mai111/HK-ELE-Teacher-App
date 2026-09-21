# HK-ELE Teacher 数据版本与来源说明

本文件只登记公开构建和复现所需的来源身份，不包含本机目录、用户名或内部研究路径。

## 当前数据版本

- 数据版本：`2026-09-14-package67-v1`
- 完整 family：163,784
- ranked / unranked：163,570 / 214
- Candidate：3,185
- inclusive Reference：3,430，其中 reference-only 245
- forms：319,924
- CPB 显示项：100
- 注册 grammatical relations：60

## 来源角色与登记哈希

| 公开来源标识 | 角色             | 登记 SHA-256                                                       |
| ------------ | ---------------- | ------------------------------------------------------------------ |
| Package67    | 数据权威         | `E95A2BFFC315C17D96BFE111469251FE4DFD7499FADDA02C14DB356700524E49` |
| Package72    | 教师前端行为参考 | `A12381C5FC4BECA12168192EA05D6358A97EFAF54D827BE9A5E11F91E6B5B1A9` |
| Package74    | 静态分片协议参考 | `BB8E626A90CECA69387A1E376D80B6139CD71721475CBE5A6FD21C9B138DA792` |

完整 Web 静态数据清单 `public/hkele-data/manifest.json.gz` 的 SHA-256 为
`95F83B04571153AD1496EE0572B3F2CB21D07E828F5184D96F3F9AFF667AEB05`。

内置 grammatical-relations 数据只把原本的本机绝对来源路径改写成公开的
`source-register/...` 标识，关系内容和登记来源哈希未改变。公开版该文件的 SHA-256 为
`7ACA47BFA405A6355300E444303D26934D158FAF45BBB5CFC45BD5967279818A`；相应离线 manifest 的
SHA-256 为 `177B918A056368162E71A7A6B5DECD650263C8C9C3AE117AD4E119EB9305D678`。

## 解释边界

- General `Unavailable` 表示该来源分量不可用，不表示频率为零。
- Candidate 与 Reference 是登记集合，不等于最终或主管确认的 Core。
- CPB、HK-ELE 数据和品牌的公开分发权限仍须由项目所有者确认。
- GitHub Pages 是公开静态托管；部署后技术访客可以读取 Web 运行所需的数据分片与更新归档。
