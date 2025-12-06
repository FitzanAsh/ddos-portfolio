from locust import HttpUser, task, between

class DDoSAttack(HttpUser):
    # Waktu tunggu sangat pendek agar request lebih banyak
    wait_time = between(0.1, 0.3)

    @task(5)  # Prioritas tinggi - serang endpoint utama
    def attack_status(self):
        self.client.get("/api/status")

    @task(3)
    def attack_metrics(self):
        self.client.get("/api/metrics")

    @task(2)
    def attack_homepage(self):
        self.client.get("/")

    @task(1)
    def attack_admin(self):
        self.client.get("/admin")
