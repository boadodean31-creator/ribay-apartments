from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0006_room_features"),
    ]

    operations = [
        migrations.AddField(model_name="sitesetting", name="step1_image", field=models.ImageField(blank=True, upload_to="site/")),
        migrations.AddField(model_name="sitesetting", name="step2_image", field=models.ImageField(blank=True, upload_to="site/")),
        migrations.AddField(model_name="sitesetting", name="step3_image", field=models.ImageField(blank=True, upload_to="site/")),
        migrations.AddField(model_name="sitesetting", name="apartment_image", field=models.ImageField(blank=True, upload_to="site/")),
        migrations.AddField(model_name="sitesetting", name="steps_decor_image", field=models.ImageField(blank=True, upload_to="site/")),
    ]
