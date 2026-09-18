import { useState } from 'react'
import { PROJECT_NAME_MAX } from '@/config/constants'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { Field, TextArea, TextInput } from '@/shared/ui/Field'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { toast } from '@/stores/toastStore'
import { persistSharedReferences } from '@/features/create/draft'
import { ReferenceCard } from '@/features/create/ReferenceEditor'

export function ProjectPage() {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0])
  const updateCurrentProject = useProjectStore((s) => s.updateCurrentProject)
  const sharedReferences = useWorkspaceStore((s) => s.sharedReferences)
  const addSharedReference = useWorkspaceStore((s) => s.addSharedReference)
  const updateSharedReference = useWorkspaceStore((s) => s.updateSharedReference)
  const removeSharedReference = useWorkspaceStore((s) => s.removeSharedReference)

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader
          title="프로젝트 공통 설정"
          description="여기서 정한 프롬프트와 이미지는 이 프로젝트의 모든 장면에 함께 전송됩니다."
        />
        <ProjectNameField key={project?.id} initialName={project?.name ?? ''} />
        <Field
          className="mt-4"
          label="공통 프롬프트"
          htmlFor="commonPrompt"
          hint="입력하는 대로 자동 저장됩니다. 장면별로 적용 여부를 끌 수 있습니다."
        >
          <TextArea
            id="commonPrompt"
            className="min-h-32"
            placeholder="예: 같은 주인공과 의상, 따뜻한 필름 색감, 차분한 카메라 움직임을 유지한다."
            value={project?.prompt ?? ''}
            onChange={(e) => updateCurrentProject({ prompt: e.target.value })}
          />
        </Field>
      </Card>

      <Card>
        <CardHeader
          title="공통 참조 이미지"
          description="한 번 업로드한 이미지를 이 프로젝트의 모든 장면에서 함께 사용합니다."
          actions={
            <Button onClick={() => addSharedReference({ type: 'image' })}>＋ 공통 이미지 추가</Button>
          }
        />
        {sharedReferences.length ? (
          <div className="space-y-2.5">
            {sharedReferences.map((ref) => (
              <ReferenceCard
                key={ref.id}
                shared
                value={ref}
                onChange={(patch) => {
                  updateSharedReference(ref.id, patch)
                  persistSharedReferences()
                }}
                onRemove={() => {
                  removeSharedReference(ref.id)
                  persistSharedReferences()
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            아직 공통 이미지가 없습니다. 인물이나 배경처럼 장면마다 반복되는 참조를 등록해두면 편합니다.
          </p>
        )}
      </Card>
    </div>
  )
}

function ProjectNameField({ initialName }: { initialName: string }) {
  const renameProject = useProjectStore((s) => s.renameProject)
  const [name, setName] = useState(initialName)
  const dirty = name.trim() !== initialName

  return (
    <Field label="프로젝트 이름" htmlFor="projectName">
      <div className="flex gap-2">
        <TextInput
          id="projectName"
          maxLength={PROJECT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          className="shrink-0"
          disabled={!dirty}
          onClick={() => {
            const next = name.trim()
            if (!next) {
              toast('프로젝트 이름을 입력해주세요.', true)
              return
            }
            renameProject(next)
            setName(next)
            toast('프로젝트 이름을 변경했습니다.')
          }}
        >
          이름 변경
        </Button>
      </div>
    </Field>
  )
}
