import dayjs from 'dayjs'
import { ulid } from 'ulid'
import { produce } from 'immer'
import { invoke } from '@tauri-apps/api'
import { open } from '@tauri-apps/api/dialog'
import { useSelector } from 'react-redux'
import React, { useEffect, useRef, useState } from 'react'
import type { ProColumns } from '@ant-design/pro-components'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FileOutlined, FolderOpenOutlined, ImportOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ProFormInstance, EditableFormInstance, ActionType } from '@ant-design/pro-components'
import { EditableProTable, ProForm, ProFormText, ProCard } from '@ant-design/pro-components'
import {
  Tabs,
  Space,
  Button,
  Descriptions,
  Segmented,
  message,
  Tooltip,
  Typography,
  Input,
  Modal
} from 'antd'
import { useTranslation } from 'react-i18next'
import FFmpegParamTable from '@/components/ffmpeg-param-table/'
import { argKeyListEn } from '@/constants/keys-en'
import i18next from 'i18next'
import { argKeyList } from '@/constants/keys'
import { parseFFUrl } from '@/utils/parseFFUrl'
import { StateType } from '@/store'

const { Paragraph, Text } = Typography

const { TextArea } = Input

type DataSourceType = {
  id: string | number
  index?: string
  key?: string
  value?: string
}

export interface IItem {
  id: string
  project_id: string
  name: string
  url: string
  pid: number
  argList: Array<object>
  log: ''
  updated_at: string
}

export interface ITabItem {
  label: string
  key: string
  id: string
  name: string
  url: string
  argList: Array<object>
}

export interface IDescItem {
  key: string
  label: string
  span: number
  children: React.ReactNode
}

const ProjectItemNew: React.FC = () => {
  const { t } = useTranslation()
  const nav = useNavigate()

  const initialItems = [
    { label: '新建命令', key: '1000', id: '-1', name: '', url: '', argList: [] }
  ]

  const [activeKey] = useState(initialItems[0].key)
  const [items] = useState<Array<ITabItem>>(initialItems)
  const [searchParams] = useSearchParams()

  const editableFormRef = useRef<EditableFormInstance>()

  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>([])

  const formRef = useRef<ProFormInstance>()

  const settings = useSelector((state: StateType) => state.settings.settingsData)
  const [rightSegmented, setRightSegmented] = useState<string | number>(1)

  const [options, setOptions] = useState(argKeyList)

  i18next.on('languageChanged', lng => {
    if (lng == 'en') {
      setOptions(argKeyListEn)
    } else {
      setOptions(argKeyList)
    }
  })

  const columns: ProColumns<DataSourceType>[] = [
    {
      title: t('参数key'),
      width: '25%',
      key: 'key',
      dataIndex: 'key',
      valueType: 'select',
      tooltip: t('不能自定义，如果下拉选项没有你想要的key，请写在value中'),
      fieldProps: {
        showSearch: true,
        options: options,
        optionLabelProp: 'value',
        // @ts-ignore
        optionRender: option => <Space>{option.data.value}</Space>
      }
    },
    {
      title: t('参数value'),
      dataIndex: 'value',
      width: '57%'
    },
    {
      title: t('操作'),
      valueType: 'option'
    }
  ]

  const [descItems, setDescItems] = useState<Array<IDescItem>>([
    {
      key: '7',
      label: 'FFMPEG URL',
      children: '',
      span: 3
    }
  ])

  const onValuesChange = () => {
    setDescItems(
      produce(draft => {
        const r: IDescItem | undefined = draft.find(i => i.key == '7')
        if (formRef.current?.getFieldsValue().url.length) {
          const arr = formRef.current?.getFieldsValue().url
          const url = arr.reduce((accumulator: string, item: DataSourceType) => {
            if (item.key && item.value) {
              return accumulator + ' ' + item.key + ' ' + item.value
            } else if (item.key) {
              return accumulator + ' ' + item.key
            } else if (item.value) {
              return accumulator + ' ' + item.value
            }
            return accumulator
          }, '')
          if (url)
            r!.children = (
              <Text copyable style={{ whiteSpace: 'pre-wrap' }}>
                ffmpeg {url}
              </Text>
            )
        }
      })
    )
  }

  const getUrl = () => {
    const arr = formRef.current?.getFieldsValue().url
    const url = arr.reduce((accumulator: string, item: DataSourceType) => {
      if (item.key && item.value) {
        return accumulator + ' ' + item.key + ' ' + item.value
      } else if (item.key) {
        return accumulator + ' ' + item.key
      } else if (item.value) {
        return accumulator + ' ' + item.value
      }
      return accumulator
    }, '')
    return 'ffmpeg' + url
  }

  const addProjectDeatail = async (opts: { name: string; url: Array<DataSourceType> }) => {
    const name = opts.name.trim()
    if (!name) {
      message.error(t('请输入名称'), 2)
      return
    }
    const pass = opts.url.findIndex(item => item.key!.trim() || item.value!.trim())
    if (pass == -1) {
      message.error(t('请设置参数'), 2)
      return
    }
    const projectDetail = {
      id: ulid(),
      status: '-1',
      project_id: searchParams.get('projectId'),
      updated_at: dayjs().format(),
      name: opts.name,
      url: getUrl(),
      log: '',
      pid: 0,
      arg_list: JSON.stringify(opts.url)
    }
    await invoke('add_project_detail', {
      projectDetail
    })
    message.success(t('新建成功'), 2)
    nav({
      pathname: `/project/list`,
      search: `projectId=${searchParams.get('projectId')}&name=${searchParams.get('name')}`
    })
  }

  const selectFileOrDir = async (row: DataSourceType, type: number) => {
    try {
      let selected = await open({
        directory: type == 1 ? false : true
      })
      if (selected) {
        // 给选择的文件和目录加上双引号
        selected = `"${selected}"`
        editableFormRef.current?.setRowData?.(row.index as string, {
          value: selected
        })
        // eslint-disable-next-line no-unsafe-optional-chaining
        const { url } = formRef.current?.getFieldsValue()
        url.forEach((item: { id: string; value: string | unknown }) => {
          if (item.id == row.id) item.value = selected
        })
        formRef.current?.setFieldValue('url', url)
        setDescItems(
          produce(draft => {
            const r = draft.find(i => i.key == '7')
            if (formRef.current?.getFieldsValue().url.length) {
              const arr = formRef.current?.getFieldsValue().url
              const url = arr.reduce((accumulator: string, item: DataSourceType) => {
                if (item.key && item.value) {
                  return accumulator + ' ' + item.key + ' ' + item.value
                } else if (item.key) {
                  return accumulator + ' ' + item.key
                } else if (item.value) {
                  return accumulator + ' ' + item.value
                }
                return accumulator
              }, '')
              if (url) r!.children = <Paragraph copyable>ffmpeg {url}</Paragraph>
            }
          })
        )
      }
    } catch (err) {
      /* empty */
    }
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ffmpegUrl, setFfmpegUurl] = useState('')
  const actionRef = useRef<ActionType>()

  const showModal = () => {
    setIsModalOpen(true)
  }

  const handleOk = () => {
    const result = parseFFUrl(ffmpegUrl)
    const res = result?.map(item => {
      return {
        ...item,
        id: ulid()
      }
    })
    const idList = res!.map((i: { id: string }) => i.id)
    setEditableRowKeys(idList)
    formRef.current?.setFieldsValue({
      name: formRef.current?.getFieldsValue().name,
      url: res
    })
    message.success(t('导入命令行成功'), 2)
    setIsModalOpen(false)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
  }

  const onChangeNew = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFfmpegUurl(e.target.value)
  }

  useEffect(() => {
    formRef.current?.setFieldsValue({
      name: formRef.current?.getFieldsValue().name,
      url: [
        {
          key: '',
          value: '',
          id: '-1'
        }
      ]
    })
    setEditableRowKeys(['-1'])
  }, [])

  return (
    <div>
      <Modal
        title={t('将ffmpeg命令行复制粘贴到下面文本框中')}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <TextArea
          value={ffmpegUrl}
          placeholder={t('请粘贴以ffmpeg开头的命令行')}
          onChange={e => {
            onChangeNew(e)
          }}
          rows={4}
        />
      </Modal>
      <Tabs
        type="card"
        activeKey={activeKey}
        items={items.map(k => {
          return {
            ...k,
            label: t(k.label)
          }
        })}
        hideAdd
      />
      {items.map(item => {
        if (item.key == activeKey)
          return (
            <ProCard key={item.key} split="vertical">
              <ProCard title="" colSpan="62%">
                <Space direction="vertical">
                  <Segmented options={[t('标准模式')]} />
                  <ProForm<{
                    name: string
                    url: Array<object>
                    argList: Array<object>
                  }>
                    grid
                    formRef={formRef}
                    onValuesChange={onValuesChange}
                    submitter={{
                      render: props => {
                        return [
                          <Button
                            type="primary"
                            key="save"
                            onClick={() => {
                              // eslint-disable-next-line react/prop-types
                              addProjectDeatail(props.form?.getFieldsValue())
                            }}
                          >
                            {t('New File')}
                          </Button>
                          // <Button
                          //   type="primary"
                          //   key="run"
                          //   onClick={() => {
                          //     // eslint-disable-next-line react/prop-types
                          //     addProjectDeatail(props.form?.getFieldsValue())
                          //   }}
                          // >
                          //   {t('新建并运行')}
                          // </Button>
                        ]
                      }
                    }}
                  >
                    <ProForm.Group>
                      <ProFormText
                        width="md"
                        name="name"
                        label={t('命令名称')}
                        required
                        initialValue={item.name}
                        placeholder={t('请输入名称')}
                        // rules={[{ required: true, message: t('请输入名称') }]}
                      />
                    </ProForm.Group>

                    <ProForm.Item
                      label={
                        <div key="555">
                          {t('FFMPEG参数设置')}{' '}
                          <Button
                            type="dashed"
                            onClick={() => {
                              showModal()
                            }}
                            icon={<ImportOutlined />}
                          >
                            {t('点击导入ffmpeg命令行')}
                            <Tooltip placement="top" title={t('导入成功后会清空当前存在的参数')}>
                              <InfoCircleOutlined />
                            </Tooltip>
                          </Button>
                        </div>
                      }
                      required
                      name="url"
                      // initialValue={item.argList}
                      initialValue={[]}
                      trigger="onValuesChange"
                    >
                      <EditableProTable<DataSourceType>
                        actionRef={actionRef}
                        rowKey="id"
                        toolBarRender={false}
                        columns={columns}
                        editableFormRef={editableFormRef}
                        recordCreatorProps={{
                          newRecordType: 'dataSource',
                          position: 'bottom',
                          creatorButtonText: <span></span>,
                          record: (): DataSourceType => ({
                            id: Date.now(),
                            key: '',
                            value: ''
                          })
                        }}
                        editable={{
                          editableKeys,
                          type: 'multiple',
                          onChange: setEditableRowKeys,
                          actionRender: (row, _, dom) => {
                            return [
                              dom.delete,
                              <Tooltip placement="top" title={t('选择文件路径')} key="file-path">
                                <FileOutlined
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    selectFileOrDir(row, 1)
                                  }}
                                />
                              </Tooltip>,
                              <Tooltip placement="top" title={t('选择目录路径')} key="dir-path">
                                <FolderOpenOutlined
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    selectFileOrDir(row, 2)
                                  }}
                                />
                              </Tooltip>
                            ]
                          }
                        }}
                      />
                    </ProForm.Item>
                  </ProForm>
                </Space>
              </ProCard>
              <ProCard title="">
                <Space direction="vertical">
                  <Segmented
                    value={rightSegmented}
                    onChange={setRightSegmented}
                    options={[
                      {
                        label: t('信息面板'),
                        value: 1
                      },
                      {
                        label: t('参数注释表'),
                        value: 2
                      }
                    ]}
                  />
                  {rightSegmented == 1 && (
                    <div>
                      <Descriptions
                        items={[
                          {
                            key: '6',
                            label: t('FFMPEG 来源'),
                            children: settings.ffmpeg == 'default' ? t('软件自带') : t('本机自带'),
                            span: 3
                          }
                        ]}
                      />
                      <Descriptions
                        layout="vertical"
                        items={descItems.slice(0, 1).map(a => {
                          return {
                            ...a,
                            label: t([a.label])
                          }
                        })}
                      />
                    </div>
                  )}
                  {rightSegmented == 2 && (
                    <div style={{ width: '100%' }}>
                      <FFmpegParamTable></FFmpegParamTable>
                    </div>
                  )}
                </Space>
              </ProCard>
            </ProCard>
          )
      })}
    </div>
  )
}

export default ProjectItemNew
