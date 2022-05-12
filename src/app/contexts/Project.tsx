import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { route } from 'preact-router'
import { useCallback, useContext, useMemo, useState } from 'preact/hooks'
import config from '../../config.json'
import type { VersionId } from '../services'
import { Store } from '../Store'
import { cleanUrl } from '../Utils'

export type Project = {
	name: string,
	namespace: string,
	version?: VersionId,
	files: ProjectFile[],
}
export const DRAFT_PROJECT: Project = {
	name: 'Drafts',
	namespace: 'draft',
	files: [],
}

export type ProjectFile = {
	type: string,
	id: string,
	data: any,
}

interface ProjectContext {
	projects: Project[],
	project: Project,
	file?: ProjectFile,
	changeProject: (name: string) => unknown,
	updateProject: (project: Partial<Project>) => unknown,
	updateFile: (type: string, id: string | undefined, file: Partial<ProjectFile>) => boolean,
	openFile: (type: string, id: string) => unknown,
	closeFile: () => unknown,
}
const Project = createContext<ProjectContext>({
	projects: [DRAFT_PROJECT],
	project: DRAFT_PROJECT,
	changeProject: () => {},
	updateProject: () => {},
	updateFile: () => false,
	openFile: () => {},
	closeFile: () => {},
})

export function useProject() {
	return useContext(Project)
}

export function ProjectProvider({ children }: { children: ComponentChildren }) {
	const [projects, setProjects] = useState<Project[]>(Store.getProjects())

	const [projectName, setProjectName] = useState<string>(DRAFT_PROJECT.name)
	const project = useMemo(() => {
		return projects.find(p => p.name === projectName) ?? DRAFT_PROJECT
	}, [projects, projectName])

	const [fileId, setFileId] = useState<[string, string] | undefined>(undefined)
	const file = useMemo(() => {
		if (!fileId) return undefined
		return project.files.find(f => f.type === fileId[0] && f.id === fileId[1])
	}, [project, fileId])

	const changeProjects = useCallback((projects: Project[]) => {
		Store.setProjects(projects)
		setProjects(projects)
	}, [])

	const updateProject = useCallback((edits: Partial<Project>) => {
		changeProjects(projects.map(p => p.name === projectName ?	{ ...p, ...edits } : p))
	}, [projects, projectName])

	const updateFile = useCallback((type: string, id: string | undefined, edits: Partial<ProjectFile>) => {
		if (!edits.id) { // remove
			updateProject({ files: project.files.filter(f => f.type !== type || f.id !== id) })
		} else {
			const newId = edits.id.includes(':') ? edits.id : `${project.namespace}:${edits.id}`
			const exists = project.files.some(f => f.type === type && f.id === newId)
			if (!id) { // create
				if (exists) return false
				updateProject({ files: [...project.files, { type, id: newId, data: edits.data ?? {} } ]})
				setFileId([type, newId])
			} else { // rename or update data
				if (file?.id === id && id !== newId && exists) {
					return false
				}
				updateProject({ files: project.files.map(f => f.type === type && f.id === id ? { ...f, ...edits, id: newId } : f)})
				if (file?.id === id) setFileId([type, newId])
			}
		}
		return true
	}, [updateProject, project, file])

	const openFile = useCallback((type: string, id: string) => {
		const gen = config.generators.find(g => g.id === type || g.path === type)
		if (!gen) {
			throw new Error(`Cannot find generator of type ${type}`)
		}
		setFileId([gen.id, id])
		route(cleanUrl(gen.url))
	}, [])

	const closeFile = useCallback(() => {
		setFileId(undefined)
	}, [])

	const value: ProjectContext = {
		projects,
		project,
		file,
		changeProject: setProjectName,
		updateProject,
		updateFile,
		openFile,
		closeFile,
	}

	return <Project.Provider value={value}>
		{children}
	</Project.Provider>
}

export function getFilePath(file: ProjectFile) {
	const [namespace, id] = file.id.includes(':') ? file.id.split(':') : ['minecraft', file.id]
	const gen = config.generators.find(g => g.id === file.type)
	if (!gen) {
		throw new Error(`Cannot find generator of type ${file.type}`)
	}
	return `data/${namespace}/${gen.path ?? gen.id}/${id}`
}