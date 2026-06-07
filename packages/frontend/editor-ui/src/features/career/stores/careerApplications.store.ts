import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type ApplicationStatus = 'to_apply' | 'applied' | 'rejected' | 'interview';

export interface JobApplication {
	id: string;
	jobTitle: string;
	company: string;
	location: string;
	salary: string;
	applyUrl: string;
	tailoredCv: string;
	status: ApplicationStatus;
	addedAt: string;
}

const STORAGE_KEY = 'n8n_career_applications';

function loadFromStorage(): JobApplication[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as JobApplication[]) : [];
	} catch {
		return [];
	}
}

function saveToStorage(applications: JobApplication[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

export const useCareerApplicationsStore = defineStore('careerApplications', () => {
	const applications = ref<JobApplication[]>(loadFromStorage());

	const byStatus = computed(
		() => (status: ApplicationStatus) => applications.value.filter((a) => a.status === status),
	);

	const counts = computed(() => ({
		total: applications.value.length,
		to_apply: applications.value.filter((a) => a.status === 'to_apply').length,
		applied: applications.value.filter((a) => a.status === 'applied').length,
		rejected: applications.value.filter((a) => a.status === 'rejected').length,
		interview: applications.value.filter((a) => a.status === 'interview').length,
	}));

	function importFromWorkflow(raw: unknown[]) {
		const imported: JobApplication[] = raw.map((item, idx) => {
			const job = item as Record<string, string>;
			return {
				id: `${Date.now()}-${idx}`,
				jobTitle: job.poste ?? job.job_title ?? 'Poste inconnu',
				company: job.entreprise ?? job.company ?? 'Entreprise inconnue',
				location: job.lieu ?? job.location ?? '',
				salary: job.salaire ?? job.salary ?? '',
				applyUrl: job.lien_candidature ?? job.apply_url ?? '',
				tailoredCv: job.cv_adapte ?? job.tailored_cv ?? '',
				status: 'to_apply' as ApplicationStatus,
				addedAt: new Date().toISOString(),
			};
		});

		// Deduplicate by jobTitle + company
		const existing = new Set(applications.value.map((a) => `${a.jobTitle}|${a.company}`));
		const newOnes = imported.filter((a) => !existing.has(`${a.jobTitle}|${a.company}`));

		applications.value = [...applications.value, ...newOnes];
		saveToStorage(applications.value);
		return newOnes.length;
	}

	function updateStatus(id: string, status: ApplicationStatus) {
		const app = applications.value.find((a) => a.id === id);
		if (app) {
			app.status = status;
			saveToStorage(applications.value);
		}
	}

	function remove(id: string) {
		applications.value = applications.value.filter((a) => a.id !== id);
		saveToStorage(applications.value);
	}

	function clearAll() {
		applications.value = [];
		saveToStorage([]);
	}

	return {
		applications,
		byStatus,
		counts,
		importFromWorkflow,
		updateStatus,
		remove,
		clearAll,
	};
});
