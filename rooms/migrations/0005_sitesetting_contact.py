from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0004_sitesetting"),
    ]

    operations = [
        migrations.AddField(model_name="sitesetting", name="contact_name", field=models.CharField(blank=True, max_length=60)),
        migrations.AddField(model_name="sitesetting", name="contact_role", field=models.CharField(blank=True, max_length=60)),
        migrations.AddField(model_name="sitesetting", name="contact_phone", field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name="sitesetting", name="contact_hours", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="sitesetting", name="contact_reply", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="sitesetting", name="contact_languages", field=models.CharField(blank=True, max_length=80)),
    ]
